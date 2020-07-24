import { expect } from 'chai'
import 'mocha'
import { BrowserDb } from '../src'

describe('BrowserDb', function() {
  describe('incorporateEntities', function() {
    it('should incorporate a simple class', function() {
      let db = new BrowserDb
      
      let obj = new SimpleClass('a', 1)
      db.incorporateEntities(obj)

      let store = db.getStore('SimpleClass')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
    })

    it('should incorporate a simple object having a className property', function() {
      let db = new BrowserDb
      
      let obj = {
        className: 'A',
        a: 'a',
        b: 1
      }

      db.incorporateEntities(obj)

      let store = db.getStore('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
    })

    it('should incorporate an array of simple objects having a className property', function() {
      let db = new BrowserDb
      
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

      db.incorporateEntities(objs)

      let store = db.getStore('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(2)
      expect(store[0].a).to.equal('a')
      expect(store[0].b).to.equal(1)
      expect(store[1].a).to.equal('c')
      expect(store[1].b).to.equal(3)

      store = db.getStore('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0].a).to.equal('b')
      expect(store[0].b).to.equal(2)
    })

    it('should incorpate an object having sub objects', function() {
      let db = new BrowserDb
      
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

      db.incorporateEntities(obj)

      let store = db.getStore('A')
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

      store = db.getStore('B')
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

      store = db.getStore('C')
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
      let db = new BrowserDb
      
      let obj = {
        className: 'A',
        a: [ 'a', { className: 'B', b: 'b'}, { className: 'C', c: 'c' }]
      }

      db.incorporateEntities(obj)

      let store = db.getStore('A')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({
        className: 'A',
        a: [ 'a', { className: 'B', b: 'b'}, { className: 'C', c: 'c' }]
      })

      store = db.getStore('B')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({ className: 'B', b: 'b'})

      store = db.getStore('C')
      expect(store).to.be.not.undefined
      expect(store.length).to.equal(1)
      expect(store[0]).to.deep.equal({ className: 'C', c: 'c' })
    })
  })

  describe('create', function() {
    it('should create an entity', async function() {
      let db = new BrowserDb
      db.create('TestClass', { a: 'a' })
      let store = db.getStore('TestClass')
      expect(store.length).to.equal(1)
    })
  })

  describe('select', function() {
    it('should find all entities with certain criteria', async function() {
      let db = new BrowserDb

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
      let db = new BrowserDb

      let obj1 = { a: 'a', b: 1 }
      let obj2 = { a: 'b', b: 1 }
      let obj3 = { a: 'a', b: 2 }
      let obj4 = { a: 'b', b: 2 }

      db.create('TestClass', obj1)
      db.create('TestClass', obj2)
      db.create('TestClass', obj3)
      db.create('TestClass', obj4)

      let result: any[] = db.update('TestClass', { a: 'c', b: 3, criteria: { a: ['a', 'b'], b: 1 }})

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
      let db = new BrowserDb

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
