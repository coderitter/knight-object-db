import { Change, Changes } from 'knight-change'
import { Criteria } from 'knight-criteria'
import { matchCriteria } from 'knight-criteria-matcher'
import { Log } from 'knight-log'
import { idProps, Schema } from './Schema'

let log = new Log('knight-object-db/ObjectDb.ts')

export class ObjectDb {

  schema: Schema

  objects: {[ entityName: string ]: any[] } = {}

  constructor(schema: Schema) {
    this.schema = schema
  }

  getObjects<T>(entityName: string): T[]
  getObjects<T>(classFunction: { new(): T }): T[]

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
      l.dev('Given object is an array. Integrating every object of that array...')

      for (let obj of object) {
        l.dev('Integrating next object of given array...', obj)
        l.dev('Going into recursion...')
        if (entityName != undefined) {
          this.integrate(entityName, obj, changes)
        }
        else {
          this.integrate(obj, changes)
        }
        l.returning('Returning from recursion. Continue to integrate all objects from given array...')
      }

      if (rootMethodCall) {
        l.dev('Wiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.dev(`Wiring '${change.entityName}'...`)
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

    let criteria: Criteria = {}

    for (let idProp of entity.idProps) {
      if (object[idProp] !== undefined) {
        criteria[idProp] = object[idProp]
      }
    }

    l.dev('Determining existing objects using criteria', criteria)

    let existingObjects: any[] = this.find(entityName, criteria)
    l.dev('existingObjects', existingObjects)

    if (existingObjects.length > 1) {
      throw new Error('There is more than one object representing the same entity in the database')
    }

    let updatedProps: string[] = []

    if (existingObjects.length == 1) {
      l.dev('The entity represented by the given object is already in the database but represented by a different object. Updating...')
      let existingObject = existingObjects[0]

      l.dev('Database is not set to immutable. Copying all values to already existing object...')
      
      for (let prop of Object.keys(object)) {
        if (entity.relationships != undefined && prop in entity.relationships) {
          continue
        }

        if (object[prop] !== undefined && existingObject[prop] !== object[prop]) {
          updatedProps.push(prop.toString())
          existingObject[prop] = object[prop]
          l.dev(`${prop} = ${object[prop]}`)
        }

        if (updatedProps.length == 0) {
          l.dev('Nothing has changed. Updated nothing...')
        }
      }

      if (updatedProps.length > 0) {
        let change = new Change(entityName, existingObject, 'update', updatedProps)
        l.dev('Properties have changed', updatedProps)
        l.dev('Adding change to list of changes...', change)
        changes.add(change)
      }
    }
    else {
      l.dev('Adding object to database...')
      objects.push(object)
      let change = new Change(entityName, object, 'create')
      
      l.dev('Created a change object which is pushed into the list of changes...', change)
      changes.changes.push(change)  
    }

    if (entity.relationships != undefined) {
      l.dev('Integrating all relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        if (typeof object[relationshipName] != 'object' || object[relationshipName] === null) {
          l.dev(`Relationship ${relationshipName} is not set. Continuing...`)
          continue
        }

        let relationship = entity.relationships[relationshipName]
        l.dev(`Integrating relationship '${relationshipName}'. Going into recursion...`)
        this.integrate(relationship.otherEntity, object[relationshipName], changes)
        l.returning('Returning from recursion started for object...', object)

        if (existingObjects.length == 0) {
          l.dev('Erasing relationship after integration into the database...', relationshipName)
          object[relationshipName] = undefined  
        }
      }
    }
    else {
      l.dev('There are no relationships')
    }

    if (rootMethodCall) {
      l.dev('Wiring all changed objects...')

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.dev(`Wiring '${change.entityName}'...`)
          this.wire(change.entityName, change.entity)
          l.returning(`Returning from wiring '${change.entityName}'...`)
        }
      }
    }

    l.returning('Returning changes...', changes)
    return changes
  }

  find<T>(entityName: string, criteria?: Criteria): T[]
  find<T>(classFunction: { new(): any }, criteria?: Criteria): T[]

  find<T>(arg0: any, criteria?: Criteria): T[] {
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
      l.dev('Given object is an array. Removing every object of that array...')

      for (let obj of object) {
        l.dev('obj', obj)
        l.dev('Going into recursion...')
        if (entityName != undefined) {
          this.remove(entityName, obj, changes)
        }
        else {
          this.remove(obj, changes)
        }
        l.returning('Returning from recursion...')
      }

      if (rootMethodCall) {
        l.dev('Unwiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.dev(`Unwiring '${change.entityName}'...`)
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

    l.dev('Determing object to remove...')

    let criteria = idProps(this.schema, entityName, object)
    l.dev('criteria', criteria)

    let objectsToRemove: any[] = this.find(entityName, criteria)
    l.dev('objects', objectsToRemove)

    if (objectsToRemove.length == 0) {
      l.returning('No object to remove could be determined. Returning changes...', changes)
      return changes
    }

    if (objectsToRemove.length > 1) {
      throw new Error('There was more than one object for criteria: ' + JSON.stringify(criteria))
    }

    let toRemove = objectsToRemove[0]

    l.dev('Removing object from database...')
    let objects = this.getObjects(entityName)
    let index = objects.indexOf(toRemove)
    l.dev('index', index)
    objects.splice(index, 1)

    let change = new Change(entityName, toRemove, 'delete')
    l.dev('Adding change to list of changes...', change)
    changes.add(change)

    l.dev('Going through all given relationships and removing them too...')

    if (entity.relationships != undefined) {
      for (let relationshipName of Object.keys(entity.relationships)) {
        l.dev('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]

        if (relationship.manyToOne === true && typeof object[relationshipName] == 'object' && object[relationshipName] !== null) {
          l.dev('Removing many-to-one relationship. Going into recursion...')
          this.remove(relationship.otherEntity, object[relationshipName], changes)
          l.returning('Returning from recursion...')
        }
        else if (relationship.oneToMany === true && object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
          for (let relationshipObject of object[relationshipName]) {
            l.dev('Removing object of one-to-many relationship. Going into recursion...')
            this.remove(relationship.otherEntity, relationshipObject, changes)
            l.returning('Returning from recursion...')
          }
        }
        else {
          l.dev('Relationship has no set object. Continuing...')
        }
      }
    }
    else {
      l.dev('Entity has no relationships...')
    }

    if (rootMethodCall) {
      l.dev('Unwiring all changed objects...')

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.dev(`Unwiring '${change.entityName}'...`)
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
      l.dev('Wiring relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        let relationship = entity.relationships[relationshipName]
        l.dev('Wiring next relationship...', relationshipName, relationship)

        let criteria: Criteria = {}
        criteria[relationship.otherId] = object[relationship.thisId]

        let relationshipObjects: any[] = this.find(relationship.otherEntity, criteria)
        l.dev('relationshipObjects', relationshipObjects)

        if (relationshipObjects.length == 0) {
          l.dev('Did not found any relationship objects. Continuing...')
          continue
        }

        if (relationship.manyToOne === true) {
          l.dev('Relationship is many-to-one')
          l.dev(`object.${relationshipName}`, object[relationshipName])

          if (object[relationshipName] !== relationshipObjects[0]) {
            l.dev('Setting relationship object on many-to-one... ')
            object[relationshipName] = relationshipObjects[0]
          }
          else {
            l.dev('Relationship is already set')
          }
        }
        else if (relationship.oneToMany === true) {
          l.dev('Relationship is one-to-many')
          l.dev(`object.${relationshipName}`, object[relationshipName])

          if (! (object[relationshipName] instanceof Array)) {
            l.dev('Initializing empty array...')
            object[relationshipName] = []
          }

          if (object[relationshipName].length == 0) {
            l.dev('Setting relationship objects all at once...')
            object[relationshipName].push(...relationshipObjects)
          }
          else {
            l.dev('Adding relationship objects one by one to avoid duplicates...')

            for (let relationshipObject of relationshipObjects) {
              if (object[relationshipName].indexOf(relationshipObject) == -1) {
                l.dev('Adding relationship object to array...', relationshipObject)
                object[relationshipName].push(relationshipObject)
              }
              else {
                l.dev('Skipping because already included...', relationshipObject)
              }
            }
          }
        }
      }
    }
    
    l.dev('Iterating through every entity adding relationships referencing the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.dev('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {
        let otherEntity = this.schema[otherEntityName]

        l.dev('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(otherEntity.relationships!)) {          
          let otherRelationship = otherEntity.relationships![otherRelationshipName]
          l.dev('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.dev('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.dev('Retrieving all objects referencing the given object...')

            let criteria: Criteria = {}
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.dev('criteria', criteria)

            let otherObjects: any[] = this.find(otherEntityName, criteria)
            l.dev('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.dev('otherObject', otherObject)

              if (otherRelationship.manyToOne === true && otherObject[otherRelationshipName] !== object) {
                l.dev('Setting object on the other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = object
              }
              else if (otherRelationship.oneToMany === true) {
                l.dev('Relationship is one-to-many')

                let index = -1

                if (otherObject[otherRelationshipName] instanceof Array) {
                  index = otherObject[otherRelationshipName].indexOf(object)
                }

                l.dev('index', index)

                if (! (otherObject[otherRelationshipName] instanceof Array)) {
                  l.dev('Initializing empty array...')
                  otherObject[otherRelationshipName] = []
                }

                if (index == -1) {
                  l.dev('Adding object to other object\'s one-to-many relationship... ' + otherRelationshipName)
                  otherObject[otherRelationshipName].push(object)
                }
                else {
                  l.dev('Object already present in other object\'s relationship. Not adding...')
                }
              }
            }
          }
          else {
            l.dev('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.dev('Entity does not have any relationships. Continuing...')
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

    l.dev('Unwiring every object that references the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.dev('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {

        l.dev('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(this.schema[otherEntityName].relationships!)) {
          let otherRelationship = this.schema[otherEntityName].relationships![otherRelationshipName]

          l.dev('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.dev('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.dev('Retrieving all objects referencing the given object...')

            let criteria: Criteria = {}
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.dev('criteria', criteria)

            let otherObjects: any[] = this.find(otherEntityName, criteria)
            l.dev('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.dev('otherObject', otherObject)

              if (otherRelationship.manyToOne === true) {
                l.dev('Unsetting other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = null
              }
              else if (otherRelationship.oneToMany === true) {
                l.dev('Relationship is one-to-many')

                if (otherObject[otherRelationshipName] instanceof Array) {
                  let index = otherObject[otherRelationshipName].indexOf(object)

                  if (index > -1) {
                    l.dev('Removing object on other object\'s one-to-many relationship... ' + otherRelationshipName)
                    otherObject[otherRelationshipName].splice(index, 1)
                  }
                  else {
                    l.dev('Object not present in other object\'s relationship. Not removing...')
                  }  
                }
                else {
                  l.dev('Object not present in other object\'s relationship. Not removing...')
                }  
              }
            }
          }
          else {
            l.dev('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.dev('Entity does not have any relationships. Continuing...')
      }
    }

    if (entity.relationships != undefined) {
      l.dev('Iterating through relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        l.dev('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]
        l.dev('relationship', relationship)

        let criteria: Criteria = {}
        criteria[relationship.otherId] = object[relationship.thisId]
        l.dev('criteria', criteria)

        let relationshipObjects: any[] = this.find(relationship.otherEntity, criteria)
        l.dev('relationshipObjects', relationshipObjects)

        if (relationship.manyToOne === true) {
          l.dev('Relationship is many-to-one', object[relationshipName])

          if (object[relationship.thisId] != null || object[relationshipName] != null) {
            l.dev('Unsetting relationship object on many-to-one... ' + relationship.thisId + ' = null')
            object[relationshipName] = null
          }
          else {
            l.dev('Relationship is already unset')
          }
        }
        else if (relationship.oneToMany === true) {
          l.dev('Relationship is one-to-many', object[relationshipName])

          if (object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
            l.dev('Unsetting array...')
            object[relationshipName] = []
          }
          else {
            l.dev('Relationship is either undefined or empty. Nothing was unset.')
          }
        }
      }
    }

    l.returning('Returning...')
  }
}
