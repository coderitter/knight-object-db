import { checkSchema, Schema } from '../src'
import { expect } from 'chai'
import 'mocha'


class A {
  constructor(props?: any) {
    Object.assign(this, props)
  }
}

class B {
  constructor(props?: any) {
    Object.assign(this, props)
  }
}

describe('Schema', function() {
  describe('checkSchema', function() {
    it('should not find any issues', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: []
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {}
          })
        ]
      )

      expect(issues.length).to.equal(0)
    })

    it('should find that the given reference objects are not of type object', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          false,
          'false'
        ]
      )

      expect(issues.length).to.equal(4)
      expect(issues[0]).to.equal('Given reference object is not of type object')
      expect(issues[1]).to.equal('Given reference object is not of type object')
    })

    it('should find that there are no schema definitions for the given reference objects', function() {
      const issues = checkSchema(
        {
        },
        [
          new A ({
            id: 1,
            bs: []
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {}
          })
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal('A: Could not find schema definition')
      expect(issues[1]).to.equal('B: Could not find schema definition')
    })

    it('should find that the id and relationship properties are defined in the reference object', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
          }),
          new B({
          })
        ]
      )

      expect(issues.length).to.equal(5)
      expect(issues[0]).to.equal("A: Given reference object does not contain the id property with name 'id'")
      expect(issues[1]).to.equal("A: Given reference object does not contain the relationship property with name 'bs'")
      expect(issues[2]).to.equal("B: Given reference object does not contain the id property with name 'id1'")
      expect(issues[3]).to.equal("B: Given reference object does not contain the id property with name 'id2'")
      expect(issues[4]).to.equal("B: Given reference object does not contain the relationship property with name 'a'")
    })

    it('should find that the relationship definitions are not having a unambiguous type', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                manyToOne: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: false,
                oneToMany: false,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: []
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {}
          })
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal("A.bs: Both 'manyToOne' and 'oneToMany' properties to be true while only one can be")
      expect(issues[1]).to.equal("B.a: Both 'manyToOne' and 'oneToMany' properties to be false while one must be true")
    })

    it('should find that the many-to-one and one-to-many relationship properties are of the wrong type', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: false
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: false
          })
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal('A.bs: The relationship is defined to be a one-to-many but the value of the property on the given reference object is not an array')
      expect(issues[1]).to.equal('B.a: The relationship is defined to be a many-to-one but the value of the property on the given reference object is not an object')
    })

    it('should find that the thisId property does not exist on the reference object and that the otherEntity does not exist in the schema', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id2',
                otherEntity: 'B2',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId2',
                otherEntity: 'A2',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: []
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {}
          })
        ]
      )

      expect(issues.length).to.equal(5)
      expect(issues[0]).to.equal("A.bs: The in 'thisId' defined property name 'id2' is not contained in the given reference object")
      expect(issues[1]).to.equal("A.bs: The in 'otherEntity' defined entity name 'B2' is not contained in the schema")
      expect(issues[2]).to.equal("B.a: The in 'thisId' defined property name 'aId2' is not contained in the given reference object")
      expect(issues[3]).to.equal("B.a: The in 'otherEntity' defined entity name 'A2' is not contained in the schema")
      expect(issues[4]).to.equal('B: The given reference objects defines further properties which were not mentioned in the schema: aId')
    })

    it('should find that the property defined in otherId is not present on the other reference object', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId2'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id2'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: []
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {}
          })
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal("A.bs: The in 'otherId' defined property name 'aId2' is not contained in the given other reference object 'B'")
      expect(issues[1]).to.equal("B.a: The in 'otherId' defined property name 'id2' is not contained in the given other reference object 'A'")
    })

    it('should find that reference objects are not provided', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal('A: No reference object given')
      expect(issues[1]).to.equal('B: No reference object given')
    })

    it('should find that the reference object defines properties which are not mentioned in the schema', function() {
      const issues = checkSchema(
        {
          'A': {
            idProps: ['id'],
            relationships: {
              'bs': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'B',
                otherId: 'aId'
              }
            }
          },
          'B': {
            idProps: ['id1', 'id2'],
            relationships: {
              'a': {
                manyToOne: true,
                thisId: 'aId',
                otherEntity: 'A',
                otherId: 'id'
              }
            }
          }
        },
        [
          new A ({
            id: 1,
            bs: [],
            additionalA1: true,
            additionalA2: true
          }),
          new B({
            id1: 1,
            id2: 2,
            aId: 1,
            a: {},
            additionalB1: true,
            additionalB2: true
          })
        ]
      )

      expect(issues.length).to.equal(2)
      expect(issues[0]).to.equal('A: The given reference objects defines further properties which were not mentioned in the schema: additionalA1, additionalA2')
      expect(issues[1]).to.equal('B: The given reference objects defines further properties which were not mentioned in the schema: additionalB1, additionalB2')
    })
  })
})