import { DeleteCriteria, ReadCriteria, UpdateCriteria } from 'mega-nice-criteria'
import { matchCriteria } from 'mega-nice-criteria-matcher'

export default class ObjectDb {

  fetches: (() => Promise<any>)[] = []
  objects: { [entityName: string]: any[] } = {}
  idProps: { [entityName: string]: string[] } = {}

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

  getObjects(entity: string): any[] {
    let objects = this.objects[entity]

    if (objects == undefined) {
      this.objects[entity] = []
      return this.objects[entity]
    }

    return objects
  }

  provideIdProps(entity: string, idProps: string[]) {
    this.idProps[entity] = idProps
  }

  getIdProps(entityName: string): string[]|undefined {
    return this.idProps[entityName]
  }

  create<T>(entity: string, object: any): void {
    let objects = this.getObjects(entity)
    objects.push(object)
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

  delete<T>(object: string, criteria?: DeleteCriteria): T[] {
    let objects = this.getObjects(object)
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

  incorporate(objectOrObjects: any|any[]): any {
    if (objectOrObjects instanceof Array) {
      let incorporatedArray = []

      for (let entity of objectOrObjects) {
        let incorporatedEntity = this.incorporate(entity)
        incorporatedArray.push(incorporatedEntity)
      }

      return incorporatedArray
    }
    else if (typeof objectOrObjects == 'object' && objectOrObjects !== null) {
      let object = objectOrObjects

      let entity
      if (typeof object.className == 'string') {
        entity = object.className
      }
      else {
        entity = object.constructor.name
      }

      let objects = this.getObjects(entity)

      // avoid circles
      if (objects.indexOf(object) > -1) {
        return
      }

      let idProps = this.getIdProps(entity)
      let incorporatedObject: any = undefined

      if (idProps) {
        let criteria: ReadCriteria = {}

        for (let idProp of idProps) {
          if (object[idProp] !== undefined)
          criteria[idProp] = object[idProp]
        }

        let incorporatedObjects = this.read(entity, criteria)

        if (incorporatedObjects != undefined && incorporatedObjects.length > 0) {
          incorporatedObject = incorporatedObjects[0]
        }
      }

      if (incorporatedObject == undefined) {
        objects.push(object)
        incorporatedObject = object
      }

      for (let prop in incorporatedObject) {
        if (! Object.prototype.hasOwnProperty.call(incorporatedObject, prop)) {
          continue
        }

        let value = incorporatedObject[prop]
        let incorporatedValue = this.incorporate(value)
        incorporatedObject[prop] = incorporatedValue
      }

      return incorporatedObject
    }
    else {
      return objectOrObjects
    }
  }
}
