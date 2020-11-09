import { Change, Changes } from 'mega-nice-change'
import { ReadCriteria } from 'mega-nice-criteria'
import { matchCriteria } from 'mega-nice-criteria-matcher'
import Log from 'mega-nice-log'
import { idProps, Schema } from './Schema'

let log = new Log('mega-nice-object-db/ObjectDb.ts')

export default class ObjectDb {

  schema: Schema
  immutableObjects: boolean

  fetches: (() => Promise<any>)[] = []
  objects: {[ entityName: string ]: any[] } = {}

  constructor(schema: Schema, immutableObjects: boolean = false) {
    this.schema = schema
    this.immutableObjects = immutableObjects
  }

  fetch(fetch: () => Promise<any>): void {
    this.fetches.push(fetch)
  }

  async fetchAll(): Promise<void> {
    let promises: Promise<any>[] = []

    for (let fetch of this.fetches) {
      let promise = fetch()
      promises.push(promise)
    }

    await Promise.all(promises)
  }

  getObjects(entityName: string): any[]
  getObjects(classFunction: { new(): any }): any[]

  getObjects(arg: any): any[] {
    let entityName

    if (typeof arg == 'string') {
      entityName = arg
    }
    else if (typeof arg == 'function' && arg.name != undefined) {
      entityName = arg.name
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function')
    }

    let objects = this.objects[entityName]

    if (objects == undefined) {
      this.objects[entityName] = []
      return this.objects[entityName]
    }

    return objects
  }

  integrate(entityName: string, object: any, changes?: Changes): Changes
  integrate(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  integrate(object: any, changes?: Changes): Changes

  integrate(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('integrate')

    let entityName
    let object
    let changes: Changes|undefined = undefined

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (typeof arg1 == 'function' && arg1.name != undefined) {
      entityName = arg1.name
    }
    else if (arg1 instanceof Array) {
      object = arg1
      changes = arg2
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      object = arg1
      entityName = object instanceof Array ? undefined : object.constructor.name
      changes = arg2
    }

    let rootMethodCall = changes == undefined
    changes = changes || new Changes

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    if (object instanceof Array) {
      l.user('Given object is an array. Integrating every object of that array...')

      for (let obj of object) {
        l.user('Integrating next object of given array...', obj)
        l.user('Going into recursion...')
        if (entityName != undefined) {
          this.integrate(entityName, obj, changes)
        }
        else {
          this.integrate(obj, changes)
        }
        l.returning('Returning from recursion. Continue to integrate all objects from given array...')
      }

      if (rootMethodCall) {
        l.user('Wiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.user(`Wiring '${change.entityName}'...`)
            this.wire(change.entityName, change.entity)
            l.returning(`Returning from wiring '${change.entityName}'...`)
          }  
        }
      }

      l.returning('Returning changes...', changes)
      return changes
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object nor an array')
    }

    if (typeof object != 'object' || object === null) {
      l.returning('Given object is not an object or null. Returning changes...', changes)
      return changes
    }

    let objects = this.getObjects(entityName)

    // avoid circles
    if (objects.indexOf(object) > -1) {
      l.returning('Object is already in the database. Returning changes...', changes)
      return changes
    }

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    let criteria: ReadCriteria = {}

    for (let idProp of entity.idProps) {
      if (object[idProp] !== undefined) {
        criteria[idProp] = object[idProp]
      }
    }

    l.user('Determining existing objects using criteria', criteria)

    let existingObjects: any[] = this.read(entityName, criteria)
    l.var('existingObjects', existingObjects)

    if (existingObjects.length > 1) {
      throw new Error('There is more than one object representing the same entity in the database')
    }

    let updatedProps: string[] = []

    if (existingObjects.length == 1) {
      l.user('The entity represented by the given object is already in the database but represented by a different object. Updating...')
      let existingObject = existingObjects[0]

      if (this.immutableObjects === true) {
        l.user('Database is set to immutable. Replacing...')
        this.unwire(entityName, existingObject)

        let index = objects.indexOf(existingObject)
        objects.splice(index, 1)

        objects.push(object)

        for (let prop of Object.keys(existingObject)) {
          if (entity.relationships != undefined && prop in entity.relationships) {
            continue
          }

          if (object[prop] !== undefined && existingObject[prop] !== object[prop]) {
            updatedProps.push(prop.toString())
          }

          if (object[prop] === undefined && existingObject[prop] !== undefined) {
            object[prop] = existingObject[prop]
          }
        }
      }
      else {
        l.user('Database is not set to immutable. Copying all values to already existing object...')
        
        for (let prop of Object.keys(object)) {
          if (entity.relationships != undefined && prop in entity.relationships) {
            continue
          }

          if (object[prop] !== undefined && existingObject[prop] !== object[prop]) {
            updatedProps.push(prop.toString())
            existingObject[prop] = object[prop]
            l.user(`${prop} = ${object[prop]}`)
          }

          if (updatedProps.length == 0) {
            l.user('Nothing has changed. Updated nothing...')
          }
        }
      }

      if (updatedProps.length > 0) {
        let updatedObject = this.immutableObjects ? object : existingObject
        let change = new Change(entityName, updatedObject, { method: 'update', props: updatedProps })
        l.user('Properties have changed', updatedProps)
        l.user('Adding change to list of changes...', change)
        changes.add(change)
      }
    }
    else {
      l.user('Adding object to database...')
      objects.push(object)
      let change = new Change(entityName, object, 'create')
      
      l.user('Created a change object which is pushed into the list of changes...', change)
      changes.changes.push(change)  
    }

    if (entity.relationships != undefined) {
      l.user('Integrating all relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        if (typeof object[relationshipName] != 'object' || object[relationshipName] === null) {
          l.user(`Relationship ${relationshipName} is not set. Continuing...`)
          continue
        }

        let relationship = entity.relationships[relationshipName]
        l.user(`Integrating relationship '${relationshipName}'. Going into recursion...`)
        this.integrate(relationship.otherEntity, object[relationshipName], changes)
        l.returning('Returning from recursion started for object...', object)

        if (existingObjects.length == 0 || existingObjects.length == 1 && this.immutableObjects) {
          l.dev('Erasing relationship after integration into the database...', relationshipName)
          object[relationshipName] = undefined  
        }
      }
    }
    else {
      l.user('There are no relationships')
    }

    if (rootMethodCall) {
      l.user('Wiring all changed objects...')

      if (existingObjects.length == 1 && this.immutableObjects) {
        this.wire(entityName, object)
      }

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.user(`Wiring '${change.entityName}'...`)
          this.wire(change.entityName, change.entity)
          l.returning(`Returning from wiring '${change.entityName}'...`)
        }
      }
    }

    l.returning('Returning changes...', changes)
    return changes
  }

  read<T>(entityName: string, criteria?: ReadCriteria): T[]
  read<T>(classFunction: { new(): any }, criteria?: ReadCriteria): T[]

  read<T>(arg0: any, criteria?: ReadCriteria): T[] {
    let entityName
    if (typeof arg0 == 'string') {
      entityName = arg0
    }
    else if (typeof arg0 == 'function' && arg0.name != undefined) {
      entityName = arg0.name
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function')
    }

    let objects = this.getObjects(entityName)
    let entities: any[] = []

    for (let object of objects) {
      if (matchCriteria(object, criteria)) {
        entities.push(object)
      }
    }

    return entities
  }

  remove(entityName: string, object: any, changes?: Changes): Changes
  remove(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  remove(object: any, changes?: Changes): Changes

  remove(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('remove')

    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (typeof arg1 == 'function') {
      entityName = arg1.name
      object = arg2
      changes = arg3
    }
    else if (arg1 instanceof Array) {
      object = arg1
      changes = arg2
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      object = arg1
      entityName = object.constructor.name
      changes = arg2
    }

    let rootMethodCall = changes == undefined
    changes = changes || new Changes

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    if (object instanceof Array) {
      l.user('Given object is an array. Removing every object of that array...')

      for (let obj of object) {
        l.var('obj', obj)
        l.user('Going into recursion...')
        if (entityName != undefined) {
          this.remove(entityName, obj, changes)
        }
        else {
          this.remove(obj, changes)
        }
        l.returning('Returning from recursion...')
      }

      if (rootMethodCall) {
        l.user('Unwiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.user(`Unwiring '${change.entityName}'...`)
            this.unwire(change.entityName, change.entity)
            l.returning(`Returning from unwiring '${change.entityName}'...`)
          }  
        }
      }

      l.returning('Returning changes...', changes)
      return changes
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object nor an array')
    }

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    if (object == undefined) {
      return changes
    }

    l.user('Determing object to remove...')

    let criteria = idProps(this.schema, entityName, object)
    l.var('criteria', criteria)

    let objectsToDelete: any[] = this.read(entityName, criteria)
    l.var('objects', objectsToDelete)

    if (objectsToDelete.length == 0) {
      l.returning('No object to remove could be determined. Returning changes...', changes)
      return changes
    }

    if (objectsToDelete.length > 1) {
      throw new Error('There was more than one object for criteria: ' + JSON.stringify(criteria))
    }

    let toDelete = objectsToDelete[0]

    l.user('Removing object from database...')
    let objects = this.getObjects(entityName)
    let index = objects.indexOf(toDelete)
    l.var('index', index)
    objects.splice(index, 1)

    let change = new Change(entityName, toDelete, [ 'delete' ])
    l.user('Adding change to list of changes...', change)
    changes.add(change)

    l.user('Going through all given relationships and removing them too...')

    if (entity.relationships != undefined) {
      for (let relationshipName of Object.keys(entity.relationships)) {
        l.var('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]

        if (relationship.manyToOne === true && typeof object[relationshipName] == 'object' && object[relationshipName] !== null) {
          l.user('Removing many-to-one relationship. Going into recursion...')
          this.remove(relationship.otherEntity, object[relationshipName], changes)
          l.returning('Returning from recursion...')
        }
        else if (relationship.oneToMany === true && object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
          for (let relationshipObject of object[relationshipName]) {
            l.user('Removing object of one-to-many relationship. Going into recursion...')
            this.remove(relationship.otherEntity, relationshipObject, changes)
            l.returning('Returning from recursion...')
          }
        }
        else {
          l.user('Relationship has no set object. Continuing...')
        }
      }
    }
    else {
      l.user('Entity has no relationships...')
    }

    if (rootMethodCall) {
      l.user('Unwiring all changed objects...')

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.user(`Unwiring '${change.entityName}'...`)
          this.unwire(change.entityName, change.entity)
          l.returning(`Returning from unwiring '${change.entityName}'...`)
        }  
      }
    }

    l.returning('Returning changes...', changes)
    return changes
  }

  wire(entityName: string, object: any): void
  wire(classFunction: { new(): any }, object: any): void
  wire(object: any): void

  wire(arg1: any, arg2?: any): void {
    let l = log.mt('wire')

    let entityName
    let object

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
    }
    else if (typeof arg1 == 'function' && arg1.name != undefined) {
      entityName = arg1.name
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      entityName = arg1.constructor.name
      object = arg1
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object')
    }

    l.param('entityName', entityName)
    l.param('object', object)

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    if (entity.relationships != undefined) {
      l.user('Wiring relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        let relationship = entity.relationships[relationshipName]
        l.user('Wiring next relationship...', relationshipName, relationship)

        let criteria = {} as ReadCriteria
        criteria[relationship.otherId] = object[relationship.thisId]

        let relationshipObjects: any[] = this.read(relationship.otherEntity, criteria)
        l.var('relationshipObjects', relationshipObjects)

        if (relationshipObjects.length == 0) {
          l.user('Did not found any relationship objects. Continuing...')
          continue
        }

        if (relationship.manyToOne === true) {
          l.user('Relationship is many-to-one')
          l.var(`object.${relationshipName}`, object[relationshipName])

          if (object[relationshipName] !== relationshipObjects[0]) {
            l.user('Setting relationship object on many-to-one... ')
            object[relationshipName] = relationshipObjects[0]
          }
          else {
            l.user('Relationship is already set')
          }
        }
        else if (relationship.oneToMany === true) {
          l.user('Relationship is one-to-many')
          l.var(`object.${relationshipName}`, object[relationshipName])

          if (this.immutableObjects && object[relationshipName] instanceof Array) {
            l.user('Objects should be treated immutable. Cloning array...')
            object[relationshipName] = object[relationshipName].slice()
          }

          if (! (object[relationshipName] instanceof Array)) {
            l.user('Initializing empty array...')
            object[relationshipName] = []
          }

          if (object[relationshipName].length == 0) {
            l.user('Setting relationship objects all at once...')
            object[relationshipName].push(...relationshipObjects)
          }
          else {
            l.user('Adding relationship objects one by one to avoid duplicates...')

            for (let relationshipObject of relationshipObjects) {
              if (object[relationshipName].indexOf(relationshipObject) == -1) {
                l.user('Adding relationship object to array...', relationshipObject)
                object[relationshipName].push(relationshipObject)
              }
              else {
                l.user('Skipping because already included...', relationshipObject)
              }
            }
          }
        }
      }
    }
    
    l.user('Iterating through every entity adding relationships referencing the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.var('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {
        let otherEntity = this.schema[otherEntityName]

        l.user('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(otherEntity.relationships!)) {          
          let otherRelationship = otherEntity.relationships![otherRelationshipName]
          l.var('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.user('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.user('Retrieving all objects referencing the given object...')

            let criteria = {} as ReadCriteria
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.var('criteria', criteria)

            let otherObjects: any[] = this.read(otherEntityName, criteria)
            l.var('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.var('otherObject', otherObject)

              if (otherRelationship.manyToOne === true && otherObject[otherRelationshipName] !== object) {
                l.user('Setting object on the other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = object
              }
              else if (otherRelationship.oneToMany === true) {
                l.user('Relationship is one-to-many')

                let index = -1

                if (otherObject[otherRelationshipName] instanceof Array) {
                  index = otherObject[otherRelationshipName].indexOf(object)
                }

                l.var('index', index)

                if (this.immutableObjects && index > -1) {
                  l.user('Objects should be treated immutable. Cloning array...')
                  otherObject[otherRelationshipName] = otherObject[otherRelationshipName].slice()
                }

                if (! (otherObject[otherRelationshipName] instanceof Array)) {
                  l.user('Initializing empty array...')
                  otherObject[otherRelationshipName] = []
                }

                if (index == -1) {
                  l.user('Adding object to other object\'s one-to-many relationship... ' + otherRelationshipName)
                  otherObject[otherRelationshipName].push(object)
                }
                else {
                  l.user('Object already present in other object\'s relationship. Not adding...')
                }
              }
            }
          }
          else {
            l.user('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.user('Entity does not have any relationships. Continuing...')
      }
    }

    l.returning('Returning...')
  }
  
  unwire(entityName: string, object: any): void
  unwire(classFunction: { new(): any }, object: any): void
  unwire(object: any): void

  unwire(arg1: any, arg2?: any): void {
    let l = log.mt('unwire')

    let entityName
    let object

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
    }
    else if (typeof arg1 == 'function' && arg1.name != undefined) {
      entityName = arg1.name
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      entityName = arg1.constructor.name
      object = arg1
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object')
    }

    l.param('entityName', entityName)
    l.param('object', object)

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    l.user('Unwiring every object that references the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.var('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {

        l.user('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(this.schema[otherEntityName].relationships!)) {
          let otherRelationship = this.schema[otherEntityName].relationships![otherRelationshipName]

          l.var('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.user('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.user('Retrieving all objects referencing the given object...')

            let criteria = {} as ReadCriteria
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.var('criteria', criteria)

            let otherObjects: any[] = this.read(otherEntityName, criteria)
            l.var('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.var('otherObject', otherObject)

              if (otherRelationship.manyToOne === true) {
                l.user('Unsetting other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = null
              }
              else if (otherRelationship.oneToMany === true) {
                l.user('Relationship is one-to-many')

                if (otherObject[otherRelationshipName] instanceof Array) {
                  let index = otherObject[otherRelationshipName].indexOf(object)

                  if (index > -1) {
                    if (this.immutableObjects) {
                      l.user('Objects should be treated immutable. Cloning array...')
                      otherObject[otherRelationshipName] = otherObject[otherRelationshipName].slice()
                    }

                    l.user('Removing object on other object\'s one-to-many relationship... ' + otherRelationshipName)
                    otherObject[otherRelationshipName].splice(index, 1)
                  }
                  else {
                    l.user('Object not present in other object\'s relationship. Not removing...')
                  }  
                }
                else {
                  l.user('Object not present in other object\'s relationship. Not removing...')
                }  
              }
            }
          }
          else {
            l.user('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.user('Entity does not have any relationships. Continuing...')
      }
    }

    if (entity.relationships != undefined) {
      l.user('Iterating through relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        l.var('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]
        l.var('relationship', relationship)

        let criteria = {} as ReadCriteria
        criteria[relationship.otherId] = object[relationship.thisId]
        l.var('criteria', criteria)

        let relationshipObjects: any[] = this.read(relationship.otherEntity, criteria)
        l.var('relationshipObjects', relationshipObjects)

        if (relationship.manyToOne === true) {
          l.user('Relationship is many-to-one', object[relationshipName])

          if (object[relationship.thisId] != null || object[relationshipName] != null) {
            l.user('Unsetting relationship object on many-to-one... ' + relationship.thisId + ' = null')
            object[relationshipName] = null
          }
          else {
            l.user('Relationship is already unset')
          }
        }
        else if (relationship.oneToMany === true) {
          l.user('Relationship is one-to-many', object[relationshipName])

          if (object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
            l.user('Unsetting array...')
            object[relationshipName] = []
          }
          else {
            l.user('Relationship is either undefined or empty. Nothing was unset.')
          }
        }
      }
    }

    l.returning('Returning...')
  }
}
