import { DbSelectParameter } from 'mega-nice-db-query-parameter'
import { matchCriteria } from 'mega-nice-db-query-parameter-matcher'

export default class BrowserDb {

  fetches: (() => Promise<any>)[] = []
  stores: { [entityName: string]: any[] } = {}

  fetch(fetch: () => Promise<any>): void {
    this.fetches.push(fetch)
  }

  fetchAll(): void {
    for (let fetch of this.fetches) {
      fetch()
    }
  }

  getStore(entityName: string): any[] {
    let store = this.stores[entityName]

    if (store == undefined) {
      this.stores[entityName] = []
      return this.stores[entityName]
    }

    return store
  }

  read<T>(entityName: string, parameter?: DbSelectParameter): T[] {
    let store = this.getStore(entityName)
    let entities: any[] = []

    for (let entity of store) {
      if (matchCriteria(entity, parameter)) {
        entities.push(entity)
      }
    }

    return entities
  }

  incorporateEntities(entityOrEntities: any|any[]): void {
    if (entityOrEntities instanceof Array) {
      for (let entity of entityOrEntities) {
        this.incorporateEntities(entity)
      }
    }
    else if (typeof entityOrEntities == 'object') {
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
