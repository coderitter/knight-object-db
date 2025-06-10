import { expect } from 'chai'
import { Change } from 'knight-change'
import 'mocha'
import { ObjectDb } from '../src'
import { ManyObject, Object1, Object2, schema } from './TestSchema'

describe('ObjectDb', function() {
  describe('integrate', function() {
    it('should add a simple classed object', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      
      let changes = db.integrate(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(obj, 'create'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)
    })

    it('should add a simple non-classed object', function() {
      let db = new ObjectDb(schema)
      
      let obj = {
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: null,
        object2Id: null
      }

      let changes = db.integrate('Object1', obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(Object1, obj, 'create'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)
    })

    it('should add a list of simple classed objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      let changes = db.integrate('Object1', objs)

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes[0]).to.deep.equal(
        new Change(objs[0], 'create'))
      expect(changes.changes[1]).to.deep.equal(
        new Change(objs[1], 'create'))
      expect(changes.changes[2]).to.deep.equal(
        new Change(objs[2], 'create'))
      
      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(3)
      expect(objects[0]).to.equal(objs[0])
      expect(objects[1]).to.equal(objs[1])
      expect(objects[2]).to.equal(objs[2])
    })

    it('should add a list of simple non-classed objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        {
          id: 1,
          property1: 'a',
          property2: 1
        },
        {
          id: 2,
          property1: 'b',
          property2: 2
        },
        {
          id: 3,
          property1: 'c',
          property2: 3
        }
      ]

      let changes = db.integrate('Object1', objs)

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes).to.deep.equal([
        new Change('Object1', objs[0], 'create'), new Change('Object1', objs[1], 'create'), new Change('Object1', objs[2], 'create')
      ])

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(3)
      expect(objects[0]).to.equal(objs[0])
      expect(objects[1]).to.equal(objs[1])
      expect(objects[2]).to.equal(objs[2])
    })

    it('should add a list of mixed simple classed objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object2('x', 'b')
      ]

      let changes = db.integrate(objs)

      expect(changes.changes.length).to.equal(2)
      expect(changes.changes[0]).to.deep.equal(
        new Change(objs[0], 'create'))
      expect(changes.changes[1]).to.deep.equal(
        new Change(objs[1], 'create'))

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.not.undefined
      expect(objects1.length).to.equal(1)
      expect(objects1[0]).to.equal(objs[0])

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.not.undefined
      expect(objects2.length).to.equal(1)
      expect(objects2[0]).to.equal(objs[1])
    })

    it('should not get into cycles', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, 1)
      obj1.object1 = obj1

      let changes = db.integrate(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'create')
      ])
    })

    it('should add multiple objects referencing each other but are not wired', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c', 1)
      let obj22 = new Object2('y', 'd', 2)
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      let changes = db.integrate([ obj11, obj12, obj21, obj22, many1, many2 ])

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, 'create'),
        new Change(obj12, 'create'),
        new Change(obj21, 'create'),
        new Change(obj22, 'create'),
        new Change(many1, 'create'),
        new Change(many2, 'create')
      ])

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.not.undefined
      expect(objects1.length).to.equal(2)
      expect(objects1[0].object1).to.equal(obj12)
      expect(objects1[0].object2).to.equal(obj21)
      expect(objects1[0].many).to.deep.equal([ many1, many2 ])
      expect(objects1[1].object1).to.equal(obj11)
      expect(objects1[1].object2).to.equal(obj22)

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.not.undefined
      expect(objects2.length).to.equal(2)
      expect(objects2[0].object1Id).to.equal(1)
      expect(objects2[0].object1).to.equal(obj11)
      expect(objects2[0].many).to.deep.equal([ many1 ])
      expect(objects2[1].object1Id).to.equal(2)
      expect(objects2[1].object1).to.equal(obj12)
      expect(objects2[1].many).to.deep.equal([ many2 ])

      let objectManies = db.getObjects('ManyObject')
      expect(objectManies).to.be.not.undefined
      expect(objectManies.length).to.equal(2)
      expect(objectManies[0].object1).to.equal(obj11)
      expect(objectManies[0].object2).to.equal(obj21)
      expect(objectManies[0].object12).to.equal(obj11)
      expect(objectManies[1].object1).to.equal(obj11)
      expect(objectManies[1].object2).to.equal(obj22)
      expect(objectManies[1].object12).to.equal(obj12)
    })

    it('should add an object with multiple relationships', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c', 1)
      let obj22 = new Object2('y', 'd', 2)
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      let changes = db.integrate(obj11)

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, 'create'),
        new Change(many1, 'create'),
        new Change(many2, 'create'),
        new Change(obj22, 'create'),
        new Change(obj12, 'create'),
        new Change(obj21, 'create'),
      ])

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.not.undefined
      expect(objects1.length).to.equal(2)
      expect(objects1[0].id).to.equal(1)
      expect(objects1[0].object1).to.equal(obj12)
      expect(objects1[0].object2).to.equal(obj21)
      expect(objects1[0].many).to.deep.equal([ many1, many2 ])
      expect(objects1[1].id).to.equal(2)
      expect(objects1[1].object1Id).to.equal(1)
      expect(objects1[1].object1).to.equal(obj11)
      expect(objects1[1].object2).to.equal(obj22)

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.not.undefined
      expect(objects2.length).to.equal(2)
      expect(objects2[0].id).to.equal('y')
      expect(objects2[0].object1Id).to.equal(2)
      expect(objects2[0].object1).to.equal(obj12)
      expect(objects2[0].many).to.deep.equal([ many2 ])
      expect(objects2[1].id).to.equal('x')
      expect(objects2[1].object1Id).to.equal(1)
      expect(objects2[1].object1).to.equal(obj11)
      expect(objects2[1].many).to.deep.equal([ many1 ])

      let objectManies = db.getObjects('ManyObject')
      expect(objectManies).to.be.not.undefined
      expect(objectManies.length).to.equal(2)
      expect(objectManies[0].object1Id).to.equal(1)
      expect(objectManies[0].object2Id).to.equal('x')
      expect(objectManies[0].object1).to.equal(obj11)
      expect(objectManies[0].object2).to.equal(obj21)
      expect(objectManies[0].object12).to.equal(obj11)
      expect(objectManies[1].object1Id).to.equal(1)
      expect(objectManies[1].object2Id).to.equal('y')
      expect(objectManies[1].object1).to.equal(obj11)
      expect(objectManies[1].object2).to.equal(obj22)
      expect(objectManies[1].object12).to.equal(obj12)
    })

    it('should replace different objects representing the same entity with just one', function() {
      let db = new ObjectDb(schema)
      let obj = {
        id: 1,
        many: [
          {
            object1Id: 1,
            object2Id: 'x',
            object2: {
              id: 'x',
              many: [
                {
                  object1Id: 1,
                  object2Id: 'x'
                }
              ]
            }
          }
        ]
      }

      db.integrate('Object1', obj)

      expect(obj.many.length).to.equal(1)
      expect(obj.many[0].object2.many.length).to.equal(1)
      expect(obj.many[0]).to.equal(obj.many[0].object2.many[0])
    })

    it('should replace different objects representing the same entity with just one', function() {
      let db = new ObjectDb(schema)
      let obj = {
        id: 1,
        many: [
          {
            object1Id: 1,
            object2Id: 'x',
            object2: {
              id: 'x',
              many: [
                {
                  object1Id: 1,
                  object2Id: 'x'
                }
              ]
            }
          }
        ]
      }

      db.integrate('Object1', obj)

      expect(obj.many.length).to.equal(1)
      expect(obj.many[0].object2.many.length).to.equal(1)
      expect(obj.many[0]).to.equal(obj.many[0].object2.many[0])
    })

    it('should update a simple classed object with a classed object', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.integrate(obj)

      let updateObj = new Object1(1, 'b', 2, 2, 'x')
      let changes = db.integrate(updateObj)

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(obj, 'update', [ 'property1', 'property2', 'object1Id', 'object2Id' ]))
    })

    it('should update a simple classed object with a non-classed object', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.integrate(obj)

      let updateObj = {
        id: 1,
        property1: 'b',
        property2: 2,
        object1Id: 2,
        object2Id: 'x'
      }
      let changes = db.integrate('Object1', updateObj)

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(obj, 'update', [ 'property1', 'property2', 'object1Id', 'object2Id' ]))
    })

    it('should update a simple non-classed object with a non-classed object', function() {
      let db = new ObjectDb(schema)
      let obj = {
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: null,
        object2Id: null
      }
      db.integrate('Object1', obj)

      let updateObj = {
        id: 1,
        property1: 'b',
        property2: 2,
        object1Id: 2,
        object2Id: 'x'
      }

      let changes = db.integrate('Object1', updateObj)

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change('Object1', obj, 'update', [ 'property1', 'property2', 'object1Id', 'object2Id' ]))
    })

    it('should update a simple non-classed object with a non-classed object', function() {
      let db = new ObjectDb(schema)
      let obj = {
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: null,
        object2Id: null
      }
      db.integrate('Object1', obj)

      let updateObj = {
        id: 1,
        property1: 'b',
        property2: 2,
        object1Id: 2,
        object2Id: 'x'
      }

      let changes = db.integrate('Object1', updateObj)

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change('Object1', obj, 'update', [ 'property1', 'property2', 'object1Id', 'object2Id' ]))
    })

    it('should update a classed many-to-one relationship with a classed update object', function() {
      let db = new ObjectDb(schema)
      let manyObj = new ManyObject(1, 'x', 'a', null)
      let obj1 = new Object1(1, 'b', 2)
      db.integrate([ manyObj, obj1 ])

      let updateManyObj = new ManyObject(1, 'x', 'b', 1)
      let updateObj1 = new Object1(1, 'c', 3)
      updateManyObj.object1 = updateObj1

      let changes = db.integrate(updateManyObj)

      expect(manyObj.property1).to.equal('b')
      expect(obj1.property1).to.equal('c')
      expect(obj1.property2).to.equal(3)

      expect(changes.changes).to.deep.equal([
        new Change(manyObj, 'update', [ 'property1', 'object1Id2' ]),
        new Change(obj1, 'update', [ 'property1', 'property2' ]),
      ])
    })

    it('should update a classed many-to-one relationship with a non-classed update object', function() {
      let db = new ObjectDb(schema)
      let manyObj = new ManyObject(1, 'x', 'a', null)
      let obj1 = new Object1(1, 'b', 2)
      db.integrate([ manyObj, obj1 ])

      let updateManyObj = { object1Id: 1, object2Id: 'x', property1: 'b', object1Id2: 1 } as any
      let updateObj1 = { id: 1, property1: 'c', property2: 3 }
      updateManyObj.object1 = updateObj1

      let changes = db.integrate('ManyObject', updateManyObj)

      expect(manyObj.property1).to.equal('b')
      expect(obj1.property1).to.equal('c')
      expect(obj1.property2).to.equal(3)

      expect(changes.changes).to.deep.equal([
        new Change(manyObj, 'update', [ 'property1', 'object1Id2' ]),
        new Change(obj1, 'update', [ 'property1', 'property2' ]),
      ])
    })

    it('should update a non-classed many-to-one relationship with a classed update object', function() {
      let db = new ObjectDb(schema)
      let manyObj = { object1Id: 1, object2Id: 'x', property1: 'a', object1Id2: null, object1: undefined } as any
      let obj1 = { id: 1, property1: 'b', property2: 2 }
      manyObj['object1'] = obj1
      db.integrate('ManyObject', manyObj)

      let updateManyObj = new ManyObject(1, 'x', 'b', 1)
      let updateObj1 = new Object1(1, 'c', 3)
      updateManyObj.object1 = updateObj1

      let changes = db.integrate(updateManyObj)

      expect(manyObj.property1).to.equal('b')
      expect(obj1.property1).to.equal('c')
      expect(obj1.property2).to.equal(3)

      expect(changes.changes).to.deep.equal([
        new Change('ManyObject', manyObj, 'update', [ 'property1', 'object1Id2' ]),
        new Change('Object1', obj1, 'update', [ 'property1', 'property2' ]),
      ])
    })

    it('should update a non-classed many-to-one relationship with a non-classed update object', function() {
      let db = new ObjectDb(schema)
      let manyObj = { object1Id: 1, object2Id: 'x', property1: 'a', object1Id2: null, object1: undefined } as any
      let obj1 = { id: 1, property1: 'b', property2: 2 }
      manyObj['object1'] = obj1
      db.integrate('ManyObject', manyObj)

      let updateManyObj = { object1Id: 1, object2Id: 'x', property1: 'b', object1Id2: 1 } as any
      let updateObj1 = { id: 1, property1: 'c', property2: 3 }
      updateManyObj.object1 = updateObj1

      let changes = db.integrate('ManyObject', updateManyObj)

      expect(manyObj.property1).to.equal('b')
      expect(obj1.property1).to.equal('c')
      expect(obj1.property2).to.equal(3)

      expect(changes.changes).to.deep.equal([
        new Change('ManyObject', manyObj, 'update', [ 'property1', 'object1Id2' ]),
        new Change('Object1', obj1, 'update', [ 'property1', 'property2' ]),
      ])
    })

    it('should update a classed one-to-many relationship with a classed update object', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1)
      let manyObj = new ManyObject(1, 'x', 'b', null)
      db.integrate([ obj1, manyObj ])

      let updateObj1 = new Object1(1, 'b', 2)
      let updateManyObj = new ManyObject(1, 'x', 'c', 1)
      updateObj1.many = [ updateManyObj ]

      let changes = db.integrate(updateObj1)

      expect(obj1.property1).to.equal('b')
      expect(obj1.property2).to.equal(2)
      expect(manyObj.property1).to.equal('c')
      expect(manyObj.object12).to.equal(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'update', [ 'property1', 'property2' ]),
        new Change(manyObj, 'update', [ 'property1', 'object1Id2' ]),
      ])
    })

    it('should update a classed one-to-many relationship with a non-classed update object', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1)
      let manyObj = new ManyObject(1, 'x', 'b', null)
      db.integrate([ obj1, manyObj ])

      let updateObj1 = { id: 1, property1: 'b', property2: 2 } as any
      let updateManyObj = { object1Id: 1, object2Id: 'x', property1: 'c', object1Id2: 1 }
      updateObj1.many = [ updateManyObj ]

      let changes = db.integrate('Object1', updateObj1)

      expect(obj1.property1).to.equal('b')
      expect(obj1.property2).to.equal(2)
      expect(manyObj.property1).to.equal('c')
      expect(manyObj.object12).to.equal(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'update', [ 'property1', 'property2' ]),
        new Change(manyObj, 'update', [ 'property1', 'object1Id2' ]),
      ])
    })

    it('should update a non-classed many-to-one relationship with a classed update object', function() {
      let db = new ObjectDb(schema)
      let obj1 = { id: 1, property1: 'a', property2: 1 } as any
      let manyObj = { object1Id: 1, object2Id: 'x', property1: 'b', object1Id2: null, object1: undefined } as any
      obj1.many = [ manyObj ]
      db.integrate('Object1', obj1)

      let updateObj1 = new Object1(1, 'b', 2)
      let updateManyObj = new ManyObject(1, 'x', 'c', 1)
      updateObj1.many = [ updateManyObj ]

      let changes = db.integrate(updateObj1)

      expect(obj1.property1).to.equal('b')
      expect(obj1.property2).to.equal(2)
      expect(manyObj.property1).to.equal('c')
      expect(manyObj.object12).to.equal(obj1)

      expect(changes.changes).to.deep.equal([
        new Change('Object1', obj1, 'update', [ 'property1', 'property2' ]),
        new Change('ManyObject', manyObj, 'update', [ 'property1', 'object1Id2' ]),
      ])
    })

    it('should update a non-classed many-to-one relationship with a non-classed update object', function() {
      let db = new ObjectDb(schema)
      let obj1 = { id: 1, property1: 'a', property2: 1 } as any
      let manyObj = { object1Id: 1, object2Id: 'x', property1: 'b', object1Id2: null, object1: undefined } as any
      obj1.many = [ manyObj ]
      db.integrate('Object1', obj1)

      let updateObj1 = { id: 1, property1: 'b', property2: 2 } as any
      let updateManyObj = { object1Id: 1, object2Id: 'x', property1: 'c', object1Id2: 1 }
      updateObj1.many = [ updateManyObj ]

      let changes = db.integrate('Object1', updateObj1)

      expect(obj1.property1).to.equal('b')
      expect(obj1.property2).to.equal(2)
      expect(manyObj.property1).to.equal('c')
      expect(manyObj.object12).to.equal(obj1)

      expect(changes.changes).to.deep.equal([
        new Change('Object1', obj1, 'update', [ 'property1', 'property2' ]),
        new Change('ManyObject', manyObj, 'update', [ 'property1', 'object1Id2' ]),
      ])
    })

    it('should update with partial objects', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a')
      obj1.object1Id = null
      db.integrate(obj1)

      let updateObj1 = new Object1(1)
      updateObj1.property2 = 1
      updateObj1.object2Id = null
      
      let changes = db.integrate(updateObj1)

      expect(obj1.id).to.equal(1)
      expect(obj1.property1).to.equal('a')
      expect(obj1.property2).to.equal(1)
      expect(obj1.object1Id).to.equal(null)
      expect(obj1.object2Id).to.equal(null)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'update', [ 'property2', 'object2Id' ])
      ])
    })

    it('should not get into a cycle when updating a recursive one-to-one relationship', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, 1)
      db.integrate(obj1)

      let updateObj1 = new Object1(1, 'b', 2, 1)
      let changes = db.integrate(updateObj1)

      expect(obj1.property1).to.equal('b')
      expect(obj1.property2).to.equal(2)
      expect(obj1.object1).to.equal(obj1)

      let object1s = db.getObjects('Object1')
      expect(object1s.length).to.equal(1)
      expect(object1s[0]).to.equal(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'update', [ 'property1', 'property2' ]),
      ])
    })

    it('should update a many-to-one relationship with a new object', function() {
      let db = new ObjectDb(schema)
      let obj11 = new Object1(1, 'a', 1, 2)
      let obj12 = new Object1(2, 'b', 2)
      obj11.object1 = obj12
      db.integrate(obj11)

      let updateObj11 = new Object1(1, 'a', 1, 3)
      let obj13 = new Object1(3, 'c', 3)
      updateObj11.object1 = obj13

      let changes = db.integrate(updateObj11)

      expect(obj11.object1).to.equal(obj13)

      let object1s = db.getObjects('Object1')
      expect(object1s.length).to.equal(3)
      expect(object1s[0]).to.equal(obj11)
      expect(object1s[1]).to.equal(obj12)
      expect(object1s[2]).to.equal(obj13)

      expect(changes.changes).to.deep.equal([
        new Change(obj11, 'update', [ 'object1Id' ]),
        new Change(obj13, 'create'),
      ])
    })

    it('should add another one-to-many', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1)
      let many1 = new ManyObject(1, 'x', 'b')
      obj1.many = [ many1 ]
      db.integrate(obj1)

      let updateObj1 = new Object1(1, 'a', 1)
      let many2 = new ManyObject(1, 'y', 'c')
      updateObj1.many = [ many2 ]

      let changes = db.integrate(updateObj1)

      expect(obj1.many).to.deep.equal([ many1, many2 ])

      let object1s = db.getObjects('Object1')
      expect(object1s.length).to.equal(1)
      expect(object1s[0]).to.equal(obj1)

      let manyObjects = db.getObjects('ManyObject')
      expect(manyObjects.length).to.equal(2)
      expect(manyObjects[0]).to.equal(many1)
      expect(manyObjects[1]).to.equal(many2)

      expect(changes.changes).to.deep.equal([
        new Change(many2, 'create'),
      ])
    })
  })

  describe('read', function() {
    it('should find all entities with certain criteria', async function() {
      let db = new ObjectDb(schema)

      db.integrate('Object1', { id: 1, a: 'a', b: 1 })
      db.integrate('Object1', { id: 2, a: 'b', b: 1 })
      db.integrate('Object1', { id: 3, a: 'a', b: 2 })
      db.integrate('Object1', { id: 4, a: 'b', b: 2 })

      let result: any[] = db.read('Object1', { a: ['a', 'b'], b: 1 })

      expect(result.length).to.equal(2)
      expect(result[0].a).to.equal('a')
      expect(result[0].b).to.equal(1)
      expect(result[1].a).to.equal('b')
      expect(result[1].b).to.equal(1)
    })
  })

  describe('remove', function() {
    it('should remove a simple class', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.integrate(obj)

      let changes = db.remove(new Object1(1))

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(new Change(obj, 'delete'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should remove a simple class given as a plain object', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.integrate(obj)

      let changes = db.remove('Object1', obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(Object1, obj, 'delete'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should remove a list of simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      db.integrate('Object1', objs)

      let changes = db.remove('Object1', [ new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3) ])

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes[0]).to.deep.equal(
        new Change(objs[0], 'delete'))
      expect(changes.changes[1]).to.deep.equal(
        new Change(objs[1], 'delete'))
      expect(changes.changes[2]).to.deep.equal(
        new Change(objs[2], 'delete'))
      
      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should remove a list of simple objects given as plain objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      db.integrate('Object1', objs)

      let changes = db.remove([ new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3) ])

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes).to.deep.equal([
        new Change('Object1', objs[0], 'delete'), new Change('Object1', objs[1], 'delete'), new Change('Object1', objs[2], 'delete')
      ])

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should remove a list of mixed simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object2('x', 'b')
      ]

      db.integrate(objs)

      let changes = db.remove([ new Object1(1, 'a', 1), new Object2('x', 'b') ])

      expect(changes.changes.length).to.equal(2)
      expect(changes.changes[0]).to.deep.equal(
        new Change(objs[0], 'delete'))
      expect(changes.changes[1]).to.deep.equal(
        new Change(objs[1], 'delete'))

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.empty

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.empty
    })

    it('should not get into cycles', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, 1)
      obj1.object1 = obj1
      db.integrate(obj1)

      let changes = db.remove(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, 'delete')
      ])

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.empty
    })

    it('should remove multiple objects referencing each other but are not wired', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c', 1)
      let obj22 = new Object2('y', 'd', 2)
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      db.integrate([ obj11, obj12, obj21, obj22, many1, many2 ])

      let changes = db.remove([ new Object1(1, 'a', 1, 2, 'x'), new Object1(2, 'b', 2, 1, 'y'), new Object2('x', 'c'), new Object2('y', 'd'), new ManyObject(1, 'x', 'e', 1), new ManyObject(1, 'y', 'f', 2) ])

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, 'delete'),
        new Change(obj12, 'delete'),
        new Change(obj21, 'delete'),
        new Change(obj22, 'delete'),
        new Change(many1, 'delete'),
        new Change(many2, 'delete')
      ])

      expect(obj11.object1).to.be.null
      expect(obj11.object2).to.be.null
      expect(obj11.many).to.be.empty
      expect(obj12.object1).to.be.null
      expect(obj12.object2).to.be.null
      expect(obj12.many).to.be.undefined
      expect(obj21.object1).to.be.null
      expect(obj21.many).to.be.empty
      expect(obj22.object1).to.be.null
      expect(obj22.many).to.be.empty
      expect(many1.object1).to.be.null
      expect(many1.object2).to.be.null
      expect(many1.object12).to.be.null
      expect(many2.object1).to.be.null
      expect(many2.object2).to.be.null
      expect(many2.object12).to.be.null

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.empty

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.empty

      let objectManies = db.getObjects('ManyObject')
      expect(objectManies).to.be.empty
    })

    it('should remove an object with multiple relationships', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c', 1)
      let obj22 = new Object2('y', 'd', 2)
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      db.integrate(obj11)

      let delObj11 = new Object1(1, 'a', 1, 2, 'x')
      let delObj22 = new Object2('y', 'd')
      let delMany1 = new ManyObject(1, 'x', 'e', 1)
      let delMany2 = new ManyObject(1, 'y', 'f', 2)

      delObj11.many = [ delMany1, delMany2 ]
      delMany2.object2 = delObj22

      let changes = db.remove(delObj11)

      expect(changes.changes.length).to.equal(4)
      expect(changes.changes).deep.equal([
        new Change(obj11, 'delete'),
        new Change(many1, 'delete'),
        new Change(many2, 'delete'),
        new Change(obj22, 'delete'),
      ])

      expect(obj11.object1).to.be.null
      expect(obj11.object2).to.be.null
      expect(obj11.many).to.be.empty
      expect(obj12.object1).to.be.null
      expect(obj12.object2).to.be.null
      expect(obj12.many).to.be.undefined
      expect(obj21.object1).to.be.null
      expect(obj21.many).to.be.empty
      expect(obj22.object1).to.be.null
      expect(obj22.many).to.be.empty
      expect(many1.object1).to.be.null
      expect(many1.object2).to.be.null
      expect(many1.object12).to.be.null
      expect(many2.object1).to.be.null
      expect(many2.object2).to.be.null
      expect(many2.object12).to.be.null

      let objects1 = db.getObjects('Object1')
      expect(objects1.length).to.be.equal(1)
      expect(objects1[0]).to.equal(obj12)

      let objects2 = db.getObjects('Object2')
      expect(objects2.length).to.be.equal(1)
      expect(objects2[0]).to.equal(obj21)

      let objectManies = db.getObjects('ManyObject')
      expect(objectManies).to.be.empty
    })

    it('should remove an object and every relationship', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c', 1)
      let obj22 = new Object2('y', 'd', 2)
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      db.integrate(obj11)

      let delObj11 = new Object1(1, 'a', 1, 2, 'x')
      let delObj12 = new Object1(2, 'b', 2, 1, 'y')
      let delObj21 = new Object2('x', 'c')
      let delObj22 = new Object2('y', 'd')
      let delMany1 = new ManyObject(1, 'x', 'e', 1)
      let delMany2 = new ManyObject(1, 'y', 'f', 2)

      delObj11.object1 = delObj12
      delObj11.object2 = delObj21
      delObj11.many = [ delMany1, delMany2 ]
      delMany2.object2 = delObj22

      let changes = db.remove(delObj11)

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, 'delete'),
        new Change(many1, 'delete'),
        new Change(many2, 'delete'),
        new Change(obj22, 'delete'),
        new Change(obj12, 'delete'),
        new Change(obj21, 'delete'),
      ])

      expect(obj11.object1).to.be.null
      expect(obj11.object2).to.be.null
      expect(obj11.many).to.be.empty
      expect(obj12.object1).to.be.null
      expect(obj12.object2).to.be.null
      expect(obj12.many).to.be.undefined
      expect(obj21.object1).to.be.null
      expect(obj21.many).to.be.empty
      expect(obj22.object1).to.be.null
      expect(obj22.many).to.be.empty
      expect(many1.object1).to.be.null
      expect(many1.object2).to.be.null
      expect(many1.object12).to.be.null
      expect(many2.object1).to.be.null
      expect(many2.object2).to.be.null
      expect(many2.object12).to.be.null

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.empty

      let objects2 = db.getObjects('Object2')
      expect(objects2).to.be.empty

      let objectManies = db.getObjects('ManyObject')
      expect(objectManies).to.be.empty
    })
  })

  describe('wire', function() {
    it('should wire nothing if there is nothing to wire', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null)
      
      db.wire(obj)

      expect(obj).to.deep.equal(new Object1(1, 'a', 1, null))
    })

    it('should wire a many-to-one along with its one-to-many', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1)
      let obj2 = new Object2('x')

      db.integrate([ obj1, obj2 ])

      let many = new ManyObject(1, 'x', 'a')

      db.wire(many)

      expect(obj1.many!.length).to.equal(1)
      expect(obj1.many![0]).to.equal(many)

      expect(obj2.many!.length).to.equal(1)
      expect(obj2.many![0]).to.equal(many)

      expect(many.object1).to.equal(obj1)
      expect(many.object2).to.equal(obj2)
    })

    it('should wire a one-to-one', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, 2, null)
      db.integrate(obj1)

      let obj2 = new Object1(2, 'b', 2, 1, null)
      
      db.wire(obj2)

      expect(obj2.object1Id).to.equal(1)
      expect(obj2.object1).to.equal(obj1)
    })
  })

  describe('unwire', function() {
    it('should unwire nothing if there is nothing to unwire', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null)
      
      db.unwire(obj)

      expect(obj).to.deep.equal(new Object1(1, 'a', 1, null))
    })

    it('should unwire a many-to-one along with its one-to-many', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1)
      let obj2 = new Object2('x')
      let many = new ManyObject(1, 'x', 'a')

      db.integrate([ obj1, obj2, many ])

      db.unwire(many)

      expect(obj1.many).to.be.empty
      expect(obj2.many).to.be.empty
      expect(many.object1).to.be.null
      expect(many.object2).to.be.null
    })

    it('should unwire a one-to-one', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, 2, null)
      let obj2 = new Object1(2, 'b', 2, 1, null)
      
      db.integrate([ obj1, obj2 ])
      
      db.unwire(obj2)

      expect(obj1.object1Id).to.equal(2)
      expect(obj1.object1).to.be.null
      expect(obj2.object1Id).to.equal(1)
      expect(obj2.object1).to.be.null
    })
  })
})
