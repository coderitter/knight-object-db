import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  object1Id?: number|null
  object2Id?: string|null

  many?: ManyObject[]
  object1?: Object1
  object2?: Object2

  constructor(id?: number, property1?: string, property2?: number, object1Id?: number|null, object2Id?: string|null) {
    this.id = id
    this.property1 = property1
    this.property2 = property2
    this.object1Id = object1Id
    this.object2Id = object2Id
  }
}

export class Object2 {
  id?: string
  property1?: string
  object1Id?: number|null
  
  object1?: Object1
  many?: ManyObject[]

  constructor(id?: string, property1?: string, object1Id?: number|null) {
    this.id = id
    this.property1 = property1
    this.object1Id = object1Id
  }
}

export class ManyObject {
  object1Id?: number
  object2Id?: string
  property1?: string|null
  object1Id2?: number|null

  object1?: Object1
  object2?: Object2
  object12?: Object1

  constructor(object1Id?: number, object2Id?: string, property1?: string|null, object1Id2?: number|null) {
    this.object1Id = object1Id
    this.object2Id = object2Id
    this.property1 = property1
    this.object1Id2 = object1Id2
  }
}

export const schema = {
  'Object1': {
    idProps: ['id'],
    relationships: {
      many: {
        oneToMany: true,
        thisId: 'id',
        otherEntity: 'ManyObject',
        otherId: 'object1Id'
      },
      object1: {
        manyToOne: true,
        thisId: 'object1Id',
        otherEntity: 'Object1',
        otherId: 'id',
        otherRelationship: 'object1'
      },
      object2: {
        manyToOne: true,
        thisId: 'object2Id',
        otherEntity: 'Object2',
        otherId: 'id',
        otherRelationship: 'object1'
      }
    }
  },
  
  'Object2': {
    idProps: ['id'],
    relationships: {
      object1: {
        manyToOne: true,
        thisId: 'object1Id',
        otherEntity: 'Object1',
        otherId: 'id',
        otherRelationship: 'object2'
      },
      many: {
        oneToMany: true,
        thisId: 'id',
        otherEntity: 'ManyObject',
        otherId: 'object2Id'
      }
    }
  },

  'ManyObject': {
    idProps: ['object1Id', 'object2Id'],
    relationships: {
      object1: {
        manyToOne: true,
        thisId: 'object1Id',
        otherEntity: 'Object1',
        otherId: 'id'
      },
      object2: {
        manyToOne: true,
        thisId: 'object2Id',
        otherEntity: 'Object2',
        otherId: 'id'
      },
      object12: {
        manyToOne: true,
        thisId: 'object1Id2',
        otherEntity: 'Object1',
        otherId: 'id'
      }
    }
  }
} as Schema