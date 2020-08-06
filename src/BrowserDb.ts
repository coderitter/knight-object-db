import { DbDeleteParameter, DbReadParameter, DbUpdateParameter } from 'mega-nice-db-query-parameter'
import { matchCriteria } from 'mega-nice-db-query-parameter-matcher'

export default class BrowserDb {

  fetches: (() => Promise<any>)[] = []
  stores: { [entityName: string]: any[] } = {}

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

  getStore(entityName: string): any[] {
    let store = this.stores[entityName]

    if (store == undefined) {
      this.stores[entityName] = []
      return this.stores[entityName]
    }

    return store
  }

  create<T>(entityName: string, entity: any): void {
    let store = this.getStore(entityName)
    store.push(entity)
  }

  read<T>(entityName: string, parameter?: DbReadParameter): T[] {
    let store = this.getStore(entityName)
    let entities: any[] = []

    for (let entity of store) {
      if (matchCriteria(entity, parameter)) {
        entities.push(entity)
      }
    }

    return entities
  }

  update<T>(entityName: string, parameter: DbUpdateParameter): T[] {
    let entities: any[] = this.read(entityName, parameter.criteria)

    for (let entity of entities) {
      for (let prop in parameter) {
        if (prop == 'criteria') {
          continue
        }

        entity[prop] = parameter[prop]
      }
    }

    return entities
  }

  delete<T>(entityName: string, parameter?: DbDeleteParameter): T[] {
    let store = this.getStore(entityName)
    let entities: any[] = []

    for (let entity of store) {
      if (matchCriteria(entity, parameter)) {
        entities.push(entity)
      }
    }

    for (let entity of entities) {
      store.splice(store.indexOf(entity), 1)
    }

    return entities
  }

  incorporateEntities(entityOrEntities: any|any[]): void {
    if (entityOrEntities instanceof Array) {
      for (let entity of entityOrEntities) {
        this.incorporateEntities(entity)
      }
    }
    else if (typeof entityOrEntities == 'object' && entityOrEntities !== null) {
      let entity = entityOrEntities

      let entityName
      if (typeof entity.className == 'string') {
        entityName = entity.className
      }
      else {
        entityName = entity.constructor.name
      }

      let store = this.getStore(entityName)
      store.push(entity)

      for (let prop in entity) {
        if (! Object.prototype.hasOwnProperty.call(entity, prop)) {
          continue
        }

        let value = entity[prop]
        this.incorporateEntities(value)
      }
    }
    else {
      // do nothing
    }
  }
}
