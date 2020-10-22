import { expect } from 'chai'
import 'mocha'
import { ObjectDb } from '../src'

describe('ObjectDb', function() {
  describe('incorporateEntities', function() {
    it('should incorporate a simple class', function() {
      let db = new ObjectDb
      
      let obj = new SimpleClass('a', 1)
      db.incorporate(obj)

      let store = db.getObjects('SimpleClass')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
    })

    it('should incorporate a simple object having a className property', function() {
      let db = new ObjectDb
      
      let obj = {
        className: 'A',
        a: 'a',
        b: 1
      }

      db.incorporate(obj)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
    })

    it('should be able to handle null values which in JavaScipt are objects', function() {
      let db = new ObjectDb
      
      let obj = {
        className: 'A',
        a: null
      }

      db.incorporate(obj)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj)
    })

    it('should incorporate an array of simple objects having a className property', function() {
      let db = new ObjectDb
      
      let objs = [
        {
          className: 'A',
          a: 'a',
          b: 1
        },
        {
          className: 'B',
          a: 'b',
          b: 2
        },
        {
          className: 'A',
          a: 'c',
          b: 3
        },
      ]

      db.incorporate(objs)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
      expect(store[1].a).to.equal('c')
      expect(store[1].b).to.equal(3)

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('b')
      expect(store[0].b).to.equal(2)
    })

    it('should incorpate an object having sub objects', function() {
      let db = new ObjectDb
      
      let obj = {
        className: 'A',
        b: {
          className: 'B',
          b1: 'b1',
          b2: {
            className: 'A',
            a21: 'a21'
          }
        },
        c: {
          className: 'C',
          c1: {
            className: 'A',
            a11: 'a11'
          },
          b2: {
            className: 'B',
            b21: 'b21'
          }
        }
      }

      db.incorporate(obj)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(3)
      expect(store[0]).to.deep.equal({
        className: 'A',
        b: {
          className: 'B',
          b1: 'b1',
          b2: {
            className: 'A',
            a21: 'a21'
          }
        },
        c: {
          className: 'C',
          c1: {
            className: 'A',
            a11: 'a11'
          },
          b2: {
            className: 'B',
            b21: 'b21'
          }
        }
      })
      expect(store[1]).to.deep.equal({
        className: 'A',
        a21: 'a21'
      })
      expect(store[2]).to.deep.equal({
        className: 'A',
        a11: 'a11'
      })

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0]).to.deep.equal({
        className: 'B',
        b1: 'b1',
        b2: {
          className: 'A',
          a21: 'a21'
        }
      })
      expect(store[1]).to.deep.equal({
        className: 'B',
        b21: 'b21'
      })

      store = db.getObjects('C')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({
        className: 'C',
        c1: {
          className: 'A',
          a11: 'a11'
        },
        b2: {
          className: 'B',
          b21: 'b21'
        }
      })
    })

    it('should incorpate an object having arrays', function() {
      let db = new ObjectDb
      
      let obj = {
        className: 'A',
        a: [ 'a', { className: 'B', b: 'b'}, { className: 'C', c: 'c' }]
      }

      db.incorporate(obj)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({
        className: 'A',
        a: [ 'a', { className: 'B', b: 'b'}, { className: 'C', c: 'c' }]
      })

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({ className: 'B', b: 'b'})

      store = db.getObjects('C')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({ className: 'C', c: 'c' })
    })

    it('should handle circular references of the same class', function() {
      let db = new ObjectDb

      class A { constructor(public a?: any) {}}

      let obj1 = new A
      let obj2 = new A

      obj1.a = obj2
      obj2.a = obj1

      db.incorporate(obj1)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0]).to.deep.equal(obj1)
      expect(store[1]).to.deep.equal(obj2)
    })

    it('should handle circular references of different classes', function() {
      let db = new ObjectDb

      class A { constructor(public a?: any) {}}
      class B { constructor(public b?: any) {}}

      let obj1 = new A
      let obj2 = new B

      obj1.a = obj2
      obj2.b = obj1

      db.incorporate(obj1)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj1)

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj2)
    })

    it('should handle circular references of with a class in between', function() {
      let db = new ObjectDb

      class A { constructor(public a?: any) {}}
      class B { constructor(public b?: any) {}}
      class C { constructor(public c?: any) {}}

      let obj1 = new A
      let obj2 = new B
      let obj3 = new C

      obj1.a = obj2
      obj2.b = obj3
      obj3.c = obj1

      db.incorporate(obj1)

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj1)

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj2)

      store = db.getObjects('C')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj3)
    })

    it('should use given idProps to avoid duplicate entries', function() {
      let db = new ObjectDb
      db.provideIdProps('A', ['id'])

      let obj1 = { className: 'A', id: 1, a: 'a' }
      let obj2 = { className: 'A', id: 1, a: 'b' }

      db.incorporate([ obj1, obj2 ])

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(obj1)
    })

    it('should use given idProps and replace the duplicate objects with the one', function() {
      let db = new ObjectDb
      db.provideIdProps('A', ['id'])
      db.provideIdProps('B', ['id'])

      let b1 = { className: 'B', id: 1, b: 1 }
      let b2 = { className: 'B', id: 1, b: 2 }
      let obj1 = { className: 'A', id: 1, a: b1 }
      let obj2 = { className: 'A', id: 2, a: b2 }

      db.incorporate([ obj1, obj2 ])

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0]).to.deep.equal({ className: 'A', id: 1, a: b1 })
      expect(store[1]).to.deep.equal({ className: 'A', id: 2, a: b1 })

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(b1)
    })    

    it('should use given idProps and replace the duplicate objects with the one inside arrays', function() {
      let db = new ObjectDb
      db.provideIdProps('A', ['id'])
      db.provideIdProps('B', ['id'])

      let b1 = { className: 'B', id: 1, b: 1 }
      let b2 = { className: 'B', id: 1, b: 2 }
      let obj1 = { className: 'A', id: 1, a: [ b1 ]}
      let obj2 = { className: 'A', id: 2, a: [ b2 ]}

      db.incorporate([ obj1, obj2 ])

      let store = db.getObjects('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0]).to.deep.equal({ className: 'A', id: 1, a: [ b1 ]})
      expect(store[1]).to.deep.equal({ className: 'A', id: 2, a: [ b1 ]})

      store = db.getObjects('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal(b1)
    })    
  })

  describe('create', function() {
    it('should create an entity', async function() {
      let db = new ObjectDb
      db.create('TestClass', { a: 'a' })
      let store = db.getObjects('TestClass')
      expect(store.length).to.equal(1)
    })
  })

  describe('select', function() {
    it('should find all entities with certain criteria', async function() {
      let db = new ObjectDb

      db.create('TestClass', { a: 'a', b: 1 })
      db.create('TestClass', { a: 'b', b: 1 })
      db.create('TestClass', { a: 'a', b: 2 })
      db.create('TestClass', { a: 'b', b: 2 })

      let result: any[] = db.read('TestClass', { a: ['a', 'b'], b: 1 })

      expect(result.length).to.equal(2)
      expect(result[0].a).to.equal('a')
      expect(result[0].b).to.equal(1)
      expect(result[1].a).to.equal('b')
      expect(result[1].b).to.equal(1)
    })
  })

  describe('update', function() {
    it('should update all entities with certain criteria', async function() {
      let db = new ObjectDb

      let obj1 = { a: 'a', b: 1 }
      let obj2 = { a: 'b', b: 1 }
      let obj3 = { a: 'a', b: 2 }
      let obj4 = { a: 'b', b: 2 }

      db.create('TestClass', obj1)
      db.create('TestClass', obj2)
      db.create('TestClass', obj3)
      db.create('TestClass', obj4)

      let result: any[] = db.update('TestClass', { a: ['a', 'b'], b: 1, '@set': { a: 'c', b: 3 }})

      expect(result.length).to.equal(2)
      expect(result[0].a).to.equal('c')
      expect(result[0].b).to.equal(3)
      expect(result[1].a).to.equal('c')
      expect(result[1].b).to.equal(3)

      expect(obj1.a).to.equal('c')
      expect(obj1.b).to.equal(3)
      expect(obj2.a).to.equal('c')
      expect(obj2.b).to.equal(3)
      expect(obj3.a).to.equal('a')
      expect(obj3.b).to.equal(2)
      expect(obj4.a).to.equal('b')
      expect(obj4.b).to.equal(2)
    })
  })

  describe('delete', function() {
    it('should delete all entities with certain criteria', async function() {
      let db = new ObjectDb

      db.create('TestClass', { a: 'a', b: 1 })
      db.create('TestClass', { a: 'b', b: 1 })
      db.create('TestClass', { a: 'a', b: 2 })
      db.create('TestClass', { a: 'b', b: 2 })

      let result: any[] = db.delete('TestClass', { a: ['a', 'b'], b: 1 })

      expect(result.length).to.equal(2)
      expect(result[0].a).to.equal('a')
      expect(result[0].b).to.equal(1)
      expect(result[1].a).to.equal('b')
      expect(result[1].b).to.equal(1)

      let readResult: any[] = db.read('TestClass')
      
      expect(readResult.length).to.equal(2)
      expect(readResult[0].a).to.equal('a')
      expect(readResult[0].b).to.equal(2)
      expect(readResult[1].a).to.equal('b')
      expect(readResult[1].b).to.equal(2)
    })
  })
})

class SimpleClass {
  className?: string
  constructor(public a: string, public b: number) {}
}
