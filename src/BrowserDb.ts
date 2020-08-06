import { DbDeleteParameter, DbReadParameter, DbUpdateParameter, DbCriteria } from 'mega-nice-db-query-parameter'
import { matchCriteria } from 'mega-nice-db-query-parameter-matcher'

export default class BrowserDb {

  fetches: (() => Promise<any>)[] = []
  stores: { [entityName: string]: any[] } = {}
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

  getStore(entityName: string): any[] {
    let store = this.stores[entityName]

    if (store == undefined) {
      this.stores[entityName] = []
      return this.stores[entityName]
    }

    return store
  }

  provideIdProps(entityName: string, idProps: string[]) {
    this.idProps[entityName] = idProps
  }

  getIdProps(entityName: string): string[]|undefined {
    return this.idProps[entityName]
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

  incorporateEntities(entityOrEntities: any|any[]): any {
    if (entityOrEntities instanceof Array) {
      let incorporatedArray = []

      for (let entity of entityOrEntities) {
        let incorporatedEntity = this.incorporateEntities(entity)
        incorporatedArray.push(incorporatedEntity)
      }

      return incorporatedArray
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

      // avoid circles
      if (store.indexOf(entity) > -1) {
        return
      }

      let idProps = this.getIdProps(entityName)
      let incorporatedEntity: any = undefined

      if (idProps) {
        let parameter: DbReadParameter = {}
        for (let idProp of idProps) {
          if (entity[idProp] !== undefined)
          parameter[idProp] = entity[idProp]
        }

        let incorporatedEntities = this.read(entityName, parameter)

        if (incorporatedEntities != undefined && incorporatedEntities.length > 0) {
          incorporatedEntity = incorporatedEntities[0]
        }
      }

      if (incorporatedEntity == undefined) {
        store.push(entity)
        incorporatedEntity = entity
      }

      for (let prop in incorporatedEntity) {
        if (! Object.prototype.hasOwnProperty.call(incorporatedEntity, prop)) {
          continue
        }

        let value = incorporatedEntity[prop]
        let incorporatedValue = this.incorporateEntities(value)
        incorporatedEntity[prop] = incorporatedValue
      }

      return incorporatedEntity
    }
    else {
      return entityOrEntities
    }
  }
}
