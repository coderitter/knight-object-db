import { Change, Changes } from 'mega-nice-change'
import { DeleteCriteria, ReadCriteria, UpdateCriteria } from 'mega-nice-criteria'
import { matchCriteria } from 'mega-nice-criteria-matcher'
import Log from 'mega-nice-log'
import { Schema } from './Schema'

let log = new Log('ObjectDb.ts')

export default class ObjectDb {

  schema: Schema
  immutableObjects: boolean

  fetches: (() => Promise<any>)[] = []
  objects: { [entityName: string]: any[] } = {}
  idProps: { [entityName: string]: string[] } = {}

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
    let entityName: string

    if (typeof arg == 'string') {
      entityName = arg
    }
    else if (typeof arg == 'function' && arg.name != undefined) {
      entityName = arg.name
    }
    else {
      return []
    }

    let objects = this.objects[entityName]

    if (objects == undefined) {
      this.objects[entityName] = []
      return this.objects[entityName]
    }

    return objects
  }

  create(entityName: string, object: any, changes?: Changes): Changes
  create(object: any, changes?: Changes): Changes

  create(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('create')

    let entityName: string|undefined = undefined
    let object: any = undefined
    let changes: Changes|undefined = undefined

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else {
      object = arg1
      entityName = object instanceof Array ? undefined : object.constructor.name
      changes = arg2
    }

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    let rootMethodCall = changes == undefined
    changes = changes || new Changes

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
      l.returning('No enity name available. Returning changes...', changes)
      return changes
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

  read<T>(entity: string, criteria?: ReadCriteria): T[] {
    let objects = this.getObjects(entity)
    let entities: any[] = []

    for (let object of objects) {
      if (matchCriteria(object, criteria)) {
        entities.push(object)
      }
    }

    return entities
  }

  update<T>(entity: string, criteria: UpdateCriteria): T[] {
    let readCriteria = {
      ...criteria
    } as ReadCriteria

    delete readCriteria['@set']

    let objects: any[] = this.read(entity, criteria)

    for (let object of objects) {
      for (let prop in criteria['@set']) {
        object[prop] = criteria[prop]
      }
    }

    return objects
  }

  delete<T>(entity: string, criteria?: DeleteCriteria): T[] {
    let objects = this.getObjects(entity)
    let deleted: any[] = []

    for (let object of objects) {
      if (matchCriteria(object, criteria)) {
        deleted.push(object)
      }
    }

    for (let object of deleted) {
      objects.splice(objects.indexOf(object), 1)
    }

    return deleted
  }

  wire(object: any, changes?: Changes): Changes
  wire(entityName: string, object: any, changes?: Changes): Changes

  wire(arg1: any, arg2?: any, arg3?: any): Changes {
    let l = log.mt('wireObject')

    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (arg1.constructor) {
      entityName = arg1.constructor.name
      object = arg1
      changes = arg2
    }
    else {
      throw new Error('Could not determine entity name. Given value did not have a constructor.')
    }

    l.param('entityName', entityName)
    l.param('object', object)
    l.param('changes', changes)

    if (changes == undefined) {
      changes = new Changes
    }

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

            l.debug('Setting id and object on the other side of the one-to-one... ' + otherRelationship.thisId + ' = ' + object[otherRelationship.otherId])
            relationshipObjects[0][otherRelationship.thisId] = object[otherRelationship.otherId]
            relationshipObjects[0][relationship.otherRelationship] = object

            let change = new Change(relationshipObjects[0], { method: 'update', props: [ otherRelationship.thisId, relationship.otherRelationship ] })
            l.debug('Adding change to list of changes...', change)
            changes.add(change)
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
    
    l.debug('Iterating through every entity which is not the one represented by the given object...')

    for (let otherEntityName of Object.keys(this.schema)) {
      if (otherEntityName == entityName) {
        continue
      }

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
                l.debug('Relationship is one-to-many', )

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
  
  unwireObject(object: any, changes?: Changes): Changes
  unwireObject(entityName: string, object: any, changes?: Changes): Changes

  unwireObject(arg1: any, arg2?: any, arg3?: any): Changes {
    let entityName
    let object
    let changes

    if (typeof arg1 == 'string') {
      entityName = arg1
      object = arg2
      changes = arg3
    }
    else if (arg1.constructor) {
      entityName = arg1.constructor.name
      object = arg1
      changes = arg2
    }
    else {
      throw new Error('Could not determine entity name. Given value did not have a constructor.')
    }

    if (changes == undefined) {
      changes = new Changes
    }

    for (let otherEntityName of Object.keys(this.schema)) {
      if (otherEntityName == entityName) {
        continue
      }

      if (this.schema[otherEntityName].relationships != undefined) {
        for (let otherRelationshipName of Object.keys(this.schema[otherEntityName].relationships!)) {
          let otherRelationship = this.schema[otherEntityName].relationships![otherRelationshipName]
          
          if (otherRelationship.otherEntity == entityName) {
            let criteria = {} as ReadCriteria
            criteria[otherRelationship.thisId] = object[otherRelationship.otherId]

            let otherObjects: any[] = this.read(otherEntityName, criteria)

            for (let otherObject of otherObjects) {
              if (otherRelationship.manyToOne === true) {
                otherObject[otherRelationship.thisId] = null
                otherObject[otherRelationshipName] = null
              }
              else {
                if (otherObject[otherRelationshipName] instanceof Array) {
                  let index = otherObject[otherRelationshipName].indexOf(object)

                  if (index > -1) {
                    if (this.immutableObjects) {
                      otherObject[otherRelationshipName] = otherObject[otherRelationshipName].slice()
                    }

                    otherObject[otherRelationshipName].splice(index, 1)
                  }
                }
              }
            }
          }
        }
      }
    }

    return changes
  }
}
