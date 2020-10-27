import { Change, Changes } from 'mega-nice-change'
import { ReadCriteria } from 'mega-nice-criteria'
import { matchCriteria } from 'mega-nice-criteria-matcher'
import Log from 'mega-nice-log'
import { idProps, Schema } from './Schema'

let log = new Log('ObjectDb.ts')

export default class ObjectDb {

  schema: Schema
  immutableObjects: boolean

  fetches: (() => Promise<any>)[] = []
  objects: {[ entityName: string ]: any[] } = {}
  idProps: {[ entityName: string ]: string[] } = {}

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

  create(entityName: string, object: any, changes?: Changes): Changes
  create(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  create(object: any, changes?: Changes): Changes

  create(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('create')

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
      l.debug('Given object is an array. Creating every object of that array...')

      for (let obj of object) {
        l.var('obj', obj)
        l.debug('Going into recursion...')
        if (entityName != undefined) {
          this.create(entityName, obj, changes)
        }
        else {
          this.create(obj, changes)
        }
        l.returning('Returning from recursion...')
      }

      if (rootMethodCall) {
        l.debug('Wiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.debug(`Wiring '${change.entityName}'...`)
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
      l.returning('Object already created. Returning changes...', changes)
      return changes
    }

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    let idProps = entity.idProps

    if (idProps) {
      let criteria: ReadCriteria = {}

      for (let idProp of idProps) {
        if (object[idProp] !== undefined) {
          criteria[idProp] = object[idProp]
        }
      }

      let existingObjects = this.read(entityName, criteria)

      if (existingObjects != undefined && existingObjects.length > 0) {
        l.returning('There already is an object which claims to be the same entity regarding its id. Returning changes...', changes)
        return changes
      }
    }

    l.debug('Pushing object into objects...')
    objects.push(object)
    let change = new Change(entityName, object, 'create')
    
    l.debug('Created a change object which is pushed into the list of changes...', change)
    changes.changes.push(change)

    if (entity.relationships != undefined) {
      l.debug('Creating all relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        if (typeof object[relationshipName] != 'object' || object[relationshipName] === null) {
          l.debug(`Relationship ${relationshipName} is not set. Continuing...`)
          continue
        }

        let relationship = entity.relationships[relationshipName]
        l.debug(`Creating relationship '${relationshipName}'. Going into recursion...`)
        this.create(relationship.otherEntity, object[relationshipName], changes)
        l.returning('Returning from recursion...')
      }
    }
    else {
      l.debug('There are no relationships')
    }

    if (rootMethodCall) {
      l.debug('Wiring all changed objects...')

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.debug(`Wiring '${change.entityName}'...`)
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

  update(entityName: string, object: any): Changes
  update(classFunction: { new(): any }, object: any): Changes
  update(object: any): Changes

  update(arg1: any, arg2?: any): Changes {
    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
    }
    else if (typeof arg1 == 'function') {
      entityName = arg1.name
      object = arg2
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      object = arg2
      entityName = object.constructor.name
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object')
    }

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    if (changes == undefined) {
      changes = new Changes
    }

    if (object == undefined) {
      return changes
    }

    let criteria = idProps(this.schema, entityName, object)
    let objects: any[] = this.read(entityName, criteria)

    if (objects.length == 0) {
      return changes
    }

    if (objects.length > 1) {
      throw new Error('There was more than one object for criteria: ' + JSON.stringify(criteria))
    }

    let toDelete = objects[0]
    let index = objects.indexOf(toDelete)
    objects.splice(index, 1)

    let change = new Change(toDelete, [ 'delete' ])
    changes.add(change)

    if (entity.relationships != undefined) {
      for (let relationshipName of Object.keys(entity.relationships)) {
        let relationship = entity.relationships[relationshipName]

        if (relationship.manyToOne === true && typeof object[relationshipName] == 'object' && object[relationshipName] !== null) {
          this.delete(relationship.otherEntity, object[relationshipName])
        }
        else if (relationship.oneToMany === true && object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
          for (let relationshipObject of object[relationshipName]) {
            this.delete(relationship.otherEntity, relationshipObject)
          }
        }
      }
    }

    return changes
  }

  delete(entityName: string, object: any, changes?: Changes): Changes
  delete(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  delete(object: any, changes?: Changes): Changes

  delete(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('delete')

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
      l.debug('Given object is an array. Deleting every object of that array...')

      for (let obj of object) {
        l.var('obj', obj)
        l.debug('Going into recursion...')
        if (entityName != undefined) {
          this.delete(entityName, obj, changes)
        }
        else {
          this.delete(obj, changes)
        }
        l.returning('Returning from recursion...')
      }

      if (rootMethodCall) {
        l.debug('Unwiring all changed objects...')

        for (let change of changes.changes) {
          if (change.entityName != undefined && change.entity != undefined) {
            l.debug(`Unwiring '${change.entityName}'...`)
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

    l.debug('Determing object to delete...')

    let criteria = idProps(this.schema, entityName, object)
    l.varInsane('criteria', criteria)

    let objectsToDelete: any[] = this.read(entityName, criteria)
    l.varInsane('objects', objectsToDelete)

    if (objectsToDelete.length == 0) {
      l.returning('No object to delete could be determined. Returning changes...', changes)
      return changes
    }

    if (objectsToDelete.length > 1) {
      throw new Error('There was more than one object for criteria: ' + JSON.stringify(criteria))
    }

    let toDelete = objectsToDelete[0]

    l.debug('Removing object to delete from database...')
    let objects = this.getObjects(entityName)
    let index = objects.indexOf(toDelete)
    l.varInsane('index', index)
    objects.splice(index, 1)

    let change = new Change(toDelete, [ 'delete' ])
    l.debug('Adding change to list of changes...', change)
    changes.add(change)

    l.debug('Going through all given relationships and deleting them too...')

    if (entity.relationships != undefined) {
      for (let relationshipName of Object.keys(entity.relationships)) {
        l.var('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]

        if (relationship.manyToOne === true && typeof object[relationshipName] == 'object' && object[relationshipName] !== null) {
          l.debug('Deleting many-to-one relationship. Going into recursion...')
          this.delete(relationship.otherEntity, object[relationshipName], changes)
          l.returning('Returning from recursion...')
        }
        else if (relationship.oneToMany === true && object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
          for (let relationshipObject of object[relationshipName]) {
            l.debug('Deleting object of one-to-many relationship. Going into recursion...')
            this.delete(relationship.otherEntity, relationshipObject, changes)
            l.returning('Returning from recursion...')
          }
        }
        else {
          l.debug('Relationship has no set object. Continuing...')
        }
      }
    }
    else {
      l.debug('Entity has no relationships...')
    }

    if (rootMethodCall) {
      l.debug('Unwiring all changed objects...')

      for (let change of changes.changes) {
        if (change.entityName != undefined && change.entity != undefined) {
          l.debug(`Unwiring '${change.entityName}'...`)
          this.unwire(change.entityName, change.entity)
          l.returning(`Returning from unwiring '${change.entityName}'...`)
        }  
      }
    }

    l.returning('Returning changes...', changes)
    return changes
  }

  wire(entityName: string, object: any, changes?: Changes): Changes
  wire(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  wire(object: any, changes?: Changes): Changes

  wire(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('wire')

    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (typeof arg1 == 'function' && arg1.name != undefined) {
      entityName = arg1.name
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      entityName = arg1.constructor.name
      object = arg1
      changes = arg2
    }

    if (changes == undefined) {
      changes = new Changes
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object')
    }

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    if (entity.relationships != undefined) {
      l.debug('Iterating through relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        l.var('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]
        l.varInsane('relationship', relationship)

        let criteria = {} as ReadCriteria
        criteria[relationship.otherId] = object[relationship.thisId]

        let relationshipObjects: any[] = this.read(relationship.otherEntity, criteria)
        l.varInsane('relationshipObjects', relationshipObjects)

        if (relationshipObjects.length == 0) {
          l.debug('Did not found any relationship objects. Continuing...')
          continue
        }

        if (relationship.manyToOne === true) {
          l.debug('Relationship is many-to-one', object[relationshipName])

          if (object[relationshipName] !== relationshipObjects[0]) {
            l.debug('Setting relationship object on many-to-one... ')
            object[relationshipName] = relationshipObjects[0]
  
            let change = new Change(object, { method: 'update', props: [relationshipName]})
            l.debug('Adding change to list of changes...', change)
            changes.add(change)
          }
          else {
            l.debug('Relationship is already set')
          }

          if (relationship.otherRelationship != undefined) {
            let otherEntity = this.schema[relationship.otherEntity]
            if (otherEntity == undefined) {
              throw new Error(`Entity '${entityName}' not contained in schema`)
            }

            if (otherEntity.relationships == undefined || otherEntity.relationships[relationship.otherRelationship] == undefined) {
              throw new Error(`Relationship '${relationship.otherRelationship} not contained in entity '${relationship.otherEntity}'`)
            }

            let otherRelationship = otherEntity.relationships[relationship.otherRelationship]

            l.debug('Relationship is also one-to-one')
            l.var('otherRelationship', otherRelationship)

            if (relationshipObjects[0][otherRelationship.thisId] !== object[otherRelationship.otherId] || relationshipObjects[0][relationship.otherRelationship] !== object) {
              l.debug('Setting id and object on the other side of the one-to-one... ' + otherRelationship.thisId + ' = ' + object[otherRelationship.otherId])
              relationshipObjects[0][otherRelationship.thisId] = object[otherRelationship.otherId]
              relationshipObjects[0][relationship.otherRelationship] = object
  
              let change = new Change(relationshipObjects[0], { method: 'update', props: [ otherRelationship.thisId, relationship.otherRelationship ] })
              l.debug('Adding change to list of changes...', change)
              changes.add(change)  
            }
            else {
              l.debug('Id and object on the other side of the one-to-one already set... ')
            }
          }
        }
        else if (relationship.oneToMany === true) {
          l.debug('Relationship is one-to-many', object[relationshipName])

          if (this.immutableObjects && object[relationshipName] instanceof Array) {
            l.debug('Objects should be treated immutable. Cloning array...')
            object[relationshipName] = object[relationshipName].slice()
          }

          if (! (object[relationshipName] instanceof Array)) {
            l.debug('Initializing empty array...')
            object[relationshipName] = []
          }

          if (object[relationshipName].length == 0) {
            l.debug('Setting relationship objects all at once...')
            object[relationshipName].push(...relationshipObjects)

            let change = new Change(object, { method: 'update', props: [ relationshipName ]})
            l.debug('Adding change to list of changes...', change)
            changes.add(change)  
          }
          else {
            l.debug('Setting relationship objects one by one to avoid duplicates...')

            let somethingWasAdded = false
            for (let relationshipObject of relationshipObjects) {
              if (object[relationshipName].indexOf(relationshipObject) == -1) {
                l.debug('Adding relationship object to array...', relationshipObject)
                object[relationshipName].push(relationshipObject)
                somethingWasAdded = true
              }
              else {
                l.debug('Skipping relationship object because it is already included...', relationshipObject)
              }
            }

            if (somethingWasAdded) {
              let change = new Change(object, { method: 'update', props: [ relationshipName ]})
              l.debug('Adding change to list of changes...', change)
              changes.add(change)    
            }
          }
        }
      }
    }
    
    l.debug('Iterating through every entity adding relationships referencing the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.var('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {
        let otherEntity = this.schema[otherEntityName]

        l.debug('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(otherEntity.relationships!)) {          
          let otherRelationship = otherEntity.relationships![otherRelationshipName]
          l.varInsane('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.debug('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.debug('Retrieving all objects referencing the given object...')

            let criteria = {} as ReadCriteria
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.varInsane('criteria', criteria)

            let otherObjects: any[] = this.read(otherEntityName, criteria)
            l.varInsane('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.var('otherObject', otherObject)

              if (otherRelationship.manyToOne === true && otherObject[otherRelationshipName] !== object) {
                l.debug('Setting object on the other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = object

                let change = new Change(otherObject, { method: 'update', props: [ otherRelationshipName ]})
                l.debug('Adding change to list of changes...', change)
                changes.add(change)
              }
              else if (otherRelationship.oneToMany === true) {
                l.debug('Relationship is one-to-many')

                let index = -1

                if (otherObject[otherRelationshipName] instanceof Array) {
                  index = otherObject[otherRelationshipName].indexOf(object)
                }

                l.varInsane('index', index)

                if (this.immutableObjects && index > -1) {
                  l.debug('Objects should be treated immutable. Cloning array...')
                  otherObject[otherRelationshipName] = otherObject[otherRelationshipName].slice()
                }

                if (! (otherObject[otherRelationshipName] instanceof Array)) {
                  l.debug('Initializing empty array...')
                  otherObject[otherRelationshipName] = []
                }

                if (index == -1) {
                  l.debug('Adding object to other object\'s one-to-many relationship... ' + otherRelationshipName)
                  otherObject[otherRelationshipName].push(object)

                  let change = new Change(otherObject, { method: 'update', props: [ otherRelationshipName ]})
                  l.debug('Adding change to list of changes...', change)
                  changes.add(change)
                }
                else {
                  l.debug('Object already present in other object\'s relationship. Not adding...')
                }
              }
            }
          }
          else {
            l.debug('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.debug('Entity does not have any relationships. Continuing...')
      }
    }

    return changes
  }
  
  unwire(entityName: string, object: any, changes?: Changes): Changes
  unwire(classFunction: { new(): any }, object: any, changes?: Changes): Changes
  unwire(object: any, changes?: Changes): Changes

  unwire(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('unwire')

    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (typeof arg1 == 'function' && arg1.name != undefined) {
      entityName = arg1.name
    }
    else if (typeof arg1 == 'object' && arg1 !== null) {
      entityName = arg1.constructor.name
      object = arg1
      changes = arg2
    }

    if (changes == undefined) {
      changes = new Changes
    }

    if (entityName == undefined) {
      throw new Error('First given parameter was neither the entity name nor a constructor function nor an object')
    }

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    let entity = this.schema[entityName]
    if (entity == undefined) {
      throw new Error(`Entity '${entityName}' not contained in schema`)
    }

    l.debug('Unwiring every object that references the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      l.var('otherEntityName', otherEntityName)

      if (this.schema[otherEntityName].relationships != undefined) {

        l.debug('Entity has relationships. Iterating through all of them...')

        for (let otherRelationshipName of Object.keys(this.schema[otherEntityName].relationships!)) {
          let otherRelationship = this.schema[otherEntityName].relationships![otherRelationshipName]

          l.varInsane('otherRelationship', otherRelationship)
          
          if (otherRelationship.otherEntity == entityName) {
            l.debug('Found relationship which is linking back to the entity represented by the given object', otherRelationshipName)
            l.debug('Retrieving all objects referencing the given object...')

            let criteria = {} as ReadCriteria
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]
            l.varInsane('criteria', criteria)

            let otherObjects: any[] = this.read(otherEntityName, criteria)
            l.varInsane('otherObjects', otherObjects)

            for (let otherObject of otherObjects) {
              l.var('otherObject', otherObject)

              if (otherRelationship.manyToOne === true) {
                l.debug('Unsetting other object\'s many-to-one relationship... ' + otherRelationshipName)
                otherObject[otherRelationshipName] = null

                let change = new Change(otherObject, { method: 'update', props: [ otherRelationshipName ]})
                l.debug('Adding change to list of changes...', change)
                changes.add(change)
              }
              else if (otherRelationship.oneToMany === true) {
                l.debug('Relationship is one-to-many')

                if (otherObject[otherRelationshipName] instanceof Array) {
                  let index = otherObject[otherRelationshipName].indexOf(object)

                  if (index > -1) {
                    if (this.immutableObjects) {
                      l.debug('Objects should be treated immutable. Cloning array...')
                      otherObject[otherRelationshipName] = otherObject[otherRelationshipName].slice()
                    }

                    l.debug('Removing object on other object\'s one-to-many relationship... ' + otherRelationshipName)
                    otherObject[otherRelationshipName].splice(index, 1)

                    let change = new Change(otherObject, { method: 'update', props: [ otherRelationshipName ]})
                    l.debug('Adding change to list of changes...', change)
                    changes.add(change)  
                  }
                  else {
                    l.debug('Object not present in other object\'s relationship. Not removing...')
                  }  
                }
                else {
                  l.debug('Object not present in other object\'s relationship. Not removing...')
                }  
              }
            }
          }
          else {
            l.debug('Relationship does not refer back to the entity represented by the given object...', otherRelationshipName)
          }
        }
      }
      else {
        l.debug('Entity does not have any relationships. Continuing...')
      }
    }

    if (entity.relationships != undefined) {
      l.debug('Iterating through relationships...')

      for (let relationshipName of Object.keys(entity.relationships)) {
        l.var('relationshipName', relationshipName)

        let relationship = entity.relationships[relationshipName]
        l.varInsane('relationship', relationship)

        let criteria = {} as ReadCriteria
        criteria[relationship.otherId] = object[relationship.thisId]
        l.varInsane('criteria', criteria)

        let relationshipObjects: any[] = this.read(relationship.otherEntity, criteria)
        l.varInsane('relationshipObjects', relationshipObjects)

        if (relationship.manyToOne === true) {
          l.debug('Relationship is many-to-one', object[relationshipName])

          if (object[relationship.thisId] != null || object[relationshipName] != null) {
            l.debug('Unsetting relationship object on many-to-one... ' + relationship.thisId + ' = null')
            object[relationshipName] = null
  
            let change = new Change(object, { method: 'update', props: [ relationshipName ]})
            l.debug('Adding change to list of changes...', change)
            changes.add(change)
          }
          else {
            l.debug('Relationship is already unset')
          }

          if (relationship.otherRelationship != undefined && relationshipObjects.length == 1) {
            let otherEntity = this.schema[relationship.otherEntity]
            if (otherEntity == undefined) {
              throw new Error(`Entity '${entityName}' not contained in schema`)
            }

            if (otherEntity.relationships == undefined || otherEntity.relationships[relationship.otherRelationship] == undefined) {
              throw new Error(`Relationship '${relationship.otherRelationship} not contained in entity '${relationship.otherEntity}'`)
            }

            let otherRelationship = otherEntity.relationships[relationship.otherRelationship]

            l.debug('Relationship is also one-to-one')
            l.var('otherRelationship', otherRelationship)

            if (relationshipObjects[0][otherRelationship.thisId] != null || relationshipObjects[0][relationship.otherRelationship] != null) {
              l.debug('Unsetting id and object on the other side of the one-to-one... ' + otherRelationship.thisId + ' = null')
              relationshipObjects[0][relationship.otherRelationship] = null
  
              let change = new Change(relationshipObjects[0], { method: 'update', props: [ relationship.otherRelationship ] })
              l.debug('Adding change to list of changes...', change)
              changes.add(change)  
            }
            else {
              l.debug('Id and object on the other side of the one-to-one already unset...')
            }
          }
        }
        else if (relationship.oneToMany === true) {
          l.debug('Relationship is one-to-many', object[relationshipName])

          if (object[relationshipName] instanceof Array && object[relationshipName].length > 0) {
            l.debug('Unsetting array...')
            object[relationshipName] = []

            let change = new Change(object, { method: 'update', props: [ relationshipName ]})
            l.debug('Adding change to list of changes...', change)
            changes.add(change)
          }
          else {
            l.debug('Relationship is either undefined or empty. Nothing was unset.')
          }
        }
      }
    }

    l.returning('Returning changes...', changes)
    return changes
  }
}
