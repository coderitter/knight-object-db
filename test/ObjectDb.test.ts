import { expect } from 'chai'
import { Change } from 'mega-nice-change'
import 'mocha'
import { ObjectDb } from '../src'
import { ManyObject, Object1, Object2, schema } from './TestSchema'

describe('ObjectDb', function() {
  describe('create', function() {
    it('should create a simple class', function() {
      let db = new ObjectDb(schema)
      
      let obj = new Object1
      obj.id = 1
      obj.property1 = 'a'
      obj.property2 = 1
      obj.object1Id = null
      obj.object2Id = null
      
      let changes = db.create(obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(obj, 'create'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)
    })

    it('should create a simple class given as a plain object', function() {
      let db = new ObjectDb(schema)
      
      let obj = {
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: null,
        object2Id: null
      }

      let changes = db.create('Object1', obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(Object1, obj, 'create'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.not.undefined
      expect(objects.length).to.equal(1)
      expect(objects[0]).to.equal(obj)
    })

    it('should create a list of simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      let changes = db.create('Object1', objs)

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

    it('should create a list of simple objects given as plain objects', function() {
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

      let changes = db.create('Object1', objs)

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

    it('should create a list of mixed simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object2('x', 'b')
      ]

      let changes = db.create(objs)

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

      let changes = db.create(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, [ 'create' ])
      ])
    })

    it('should create multiple objects referencing each other but are not wired', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c')
      let obj22 = new Object2('y', 'd')
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      let changes = db.create([ obj11, obj12, obj21, obj22, many1, many2 ])

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, ['create']),
        new Change(obj12, ['create']),
        new Change(obj21, ['create']),
        new Change(obj22, ['create']),
        new Change(many1, ['create']),
        new Change(many2, ['create'])
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

    it('should create an object with multiple relationships', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, undefined, 'y')
      let obj21 = new Object2('x', 'c')
      let obj22 = new Object2('y', 'd')
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      let changes = db.create(obj11)

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, ['create']),
        new Change(many1, ['create']),
        new Change(many2, ['create']),
        new Change(obj22, ['create']),
        new Change(obj12, ['create']),
        new Change(obj21, ['create']),
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
  })

  describe('select', function() {
    it('should find all entities with certain criteria', async function() {
      let db = new ObjectDb(schema)

      db.create('Object1', { id: 1, a: 'a', b: 1 })
      db.create('Object1', { id: 2, a: 'b', b: 1 })
      db.create('Object1', { id: 3, a: 'a', b: 2 })
      db.create('Object1', { id: 4, a: 'b', b: 2 })

      let result: any[] = db.read('Object1', { a: ['a', 'b'], b: 1 })

      expect(result.length).to.equal(2)
      expect(result[0].a).to.equal('a')
      expect(result[0].b).to.equal(1)
      expect(result[1].a).to.equal('b')
      expect(result[1].b).to.equal(1)
    })
  })

  describe('delete', function() {
    it('should delete a simple class', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.create(obj)

      let changes = db.delete(new Object1(1))

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(obj, 'delete'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should delete a simple class given as a plain object', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null, null)
      db.create(obj)

      let changes = db.delete('Object1', obj)

      expect(changes.changes.length).to.equal(1)
      expect(changes.changes[0]).to.deep.equal(
        new Change(Object1, obj, 'delete'))

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should delete a list of simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      db.create('Object1', objs)

      let changes = db.delete('Object1', [ new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3) ])

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

    it('should delete a list of simple objects given as plain objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3)
      ]

      db.create('Object1', objs)

      let changes = db.delete([ new Object1(1, 'a', 1), new Object1(2, 'b', 2), new Object1(3, 'c', 3) ])

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes).to.deep.equal([
        new Change('Object1', objs[0], 'delete'), new Change('Object1', objs[1], 'delete'), new Change('Object1', objs[2], 'delete')
      ])

      let objects = db.getObjects('Object1')
      expect(objects).to.be.empty
    })

    it('should delete a list of mixed simple objects', function() {
      let db = new ObjectDb(schema)
      
      let objs = [
        new Object1(1, 'a', 1), new Object2('x', 'b')
      ]

      db.create(objs)

      let changes = db.delete([ new Object1(1, 'a', 1), new Object2('x', 'b') ])

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
      db.create(obj1)

      let changes = db.delete(obj1)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, [ 'delete' ])
      ])

      let objects1 = db.getObjects('Object1')
      expect(objects1).to.be.empty
    })

    it('should delete multiple objects referencing each other but are not wired', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, 1, 'y')
      let obj21 = new Object2('x', 'c')
      let obj22 = new Object2('y', 'd')
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      db.create([ obj11, obj12, obj21, obj22, many1, many2 ])

      let changes = db.delete([ new Object1(1, 'a', 1, 2, 'x'), new Object1(2, 'b', 2, 1, 'y'), new Object2('x', 'c'), new Object2('y', 'd'), new ManyObject(1, 'x', 'e', 1), new ManyObject(1, 'y', 'f', 2) ])

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, ['delete']),
        new Change(obj12, ['delete']),
        new Change(obj21, ['delete']),
        new Change(obj22, ['delete']),
        new Change(many1, ['delete']),
        new Change(many2, ['delete'])
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

    it('should delete an object with multiple relationships', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, undefined, 'y')
      let obj21 = new Object2('x', 'c')
      let obj22 = new Object2('y', 'd')
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      db.create(obj11)

      let delObj11 = new Object1(1, 'a', 1, 2, 'x')
      let delObj22 = new Object2('y', 'd')
      let delMany1 = new ManyObject(1, 'x', 'e', 1)
      let delMany2 = new ManyObject(1, 'y', 'f', 2)

      delObj11.many = [ delMany1, delMany2 ]
      delMany2.object2 = delObj22

      let changes = db.delete(delObj11)

      expect(changes.changes.length).to.equal(4)
      expect(changes.changes).deep.equal([
        new Change(obj11, ['delete']),
        new Change(many1, ['delete']),
        new Change(many2, ['delete']),
        new Change(obj22, ['delete']),
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

    it('should delete an object and every relationship', function() {
      let db = new ObjectDb(schema)

      let obj11 = new Object1(1, 'a', 1, 2, 'x')
      let obj12 = new Object1(2, 'b', 2, undefined, 'y')
      let obj21 = new Object2('x', 'c')
      let obj22 = new Object2('y', 'd')
      let many1 = new ManyObject(1, 'x', 'e', 1)
      let many2 = new ManyObject(1, 'y', 'f', 2)

      obj11.object1 = obj12
      obj11.object2 = obj21
      obj11.many = [ many1, many2 ]
      many2.object2 = obj22

      db.create(obj11)

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

      let changes = db.delete(delObj11)

      expect(changes.changes.length).to.equal(6)
      expect(changes.changes).deep.equal([
        new Change(obj11, ['delete']),
        new Change(many1, ['delete']),
        new Change(many2, ['delete']),
        new Change(obj22, ['delete']),
        new Change(obj12, ['delete']),
        new Change(obj21, ['delete']),
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
      
      let changes = db.wire(obj)

      expect(changes.changes).to.be.empty
      expect(obj).to.deep.equal(new Object1(1, 'a', 1, null))
    })

    it('should wire a many-to-one along with its one-to-many', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1)
      let obj2 = new Object2('x')

      db.create([ obj1, obj2 ])

      let many = new ManyObject(1, 'x', 'a')

      let changes = db.wire(many)

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes).to.deep.equal([
        new Change(many, { method: 'update', props: ['object1', 'object2'] }),
        new Change(obj1, { method: 'update', props: ['many'] }),
        new Change(obj2, { method: 'update', props: ['many'] })
      ])

      expect(obj1.many!.length).to.equal(1)
      expect(obj1.many![0]).to.equal(many)

      expect(obj2.many!.length).to.equal(1)
      expect(obj2.many![0]).to.equal(many)

      expect(many.object1).to.equal(obj1)
      expect(many.object2).to.equal(obj2)
    })

    it('should wire a one-to-one', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, null, null)
      db.create(obj1)

      let obj2 = new Object1(2, 'b', 2, 1, null)
      
      let changes = db.wire(obj2)

      expect(changes.changes).to.deep.equal([
        new Change(obj2, { method: 'update', props: [ 'object1' ] }),
        new Change(obj1, { method: 'update', props: [ 'object1Id', 'object1' ] })
      ])

      expect(obj2.object1Id).to.equal(1)
      expect(obj2.object1).to.equal(obj1)
    })
  })

  describe('unwire', function() {
    it('should unwire nothing if there is nothing to unwire', function() {
      let db = new ObjectDb(schema)
      let obj = new Object1(1, 'a', 1, null)
      
      let changes = db.unwire(obj)

      expect(changes.changes).to.be.empty
      expect(obj).to.deep.equal(new Object1(1, 'a', 1, null))
    })

    it('should unwire a many-to-one along with its one-to-many', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1)
      let obj2 = new Object2('x')
      let many = new ManyObject(1, 'x', 'a')

      db.create([ obj1, obj2, many ])

      let changes = db.unwire(many)

      expect(changes.changes.length).to.equal(3)
      expect(changes.changes).to.deep.equal([
        new Change(obj1, { method: 'update', props: [ 'many' ] }),
        new Change(obj2, { method: 'update', props: [ 'many' ] }),
        new Change(many, { method: 'update', props: [ 'object1Id', 'object1', 'object2Id', 'object2' ] }),
      ])

      expect(obj1.many).to.be.empty
      expect(obj2.many).to.be.empty
      expect(many.object1).to.be.null
      expect(many.object2).to.be.null
    })

    it('should unwire a one-to-one', function() {
      let db = new ObjectDb(schema)
      let obj1 = new Object1(1, 'a', 1, null, null)
      let obj2 = new Object1(2, 'b', 2, 1, null)
      
      db.create([ obj1, obj2 ])
      
      let changes = db.unwire(obj2)

      expect(changes.changes).to.deep.equal([
        new Change(obj1, { method: 'update', props: [ 'object1Id', 'object1' ] }),
        new Change(obj2, { method: 'update', props: [ 'object1Id', 'object1' ] }),
      ])

      expect(obj1.object1Id).to.be.null
      expect(obj1.object1).to.be.null
      expect(obj2.object1Id).to.be.null
      expect(obj2.object1).to.be.null
    })
  })
})
