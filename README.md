# Knight Object DB by Coderitter

An in-memory database for objects. It is a really nice fit for browsers that want to store the user data locally to offer offline capabilities. Changed entities can be updated or removed and the database can be queried.

## Related packages

This package uses [knight-change](https://github.com/c0deritter/knight-change) to return a list of changes the database undertook while integrating or removing objects. Furthermore it uses [knight-criteria](https://github.com/c0deritter/knight-criteria) to offer an interface for querying the database for objects.

You can combine this package with [knight-event-bus](https://github.com/c0deritter/knight-event-bus) to distribute changes to UI components for example of a React app. The components would listen to changes and if one is relevant for what they are displaying they would rerender accordingly. This way you can have a local data storage which can be updated from the server and every time something changes the components can rerender. You can realize contineous UI updates and offline capabilities with this.

## Install

`npm install knight-change`

## Overview

### Define domain objects

```typescript
class Knight {
    id?: number
    name?: string
    bestFriendId?: number
  
    bestFriend?: Knight
    knightsWhoThinkIAmTheirBestFriend?: Knight[]
    address?: Address
}

class Address {
    knightId?: number
    street?: string

    knight?: Knight
}
```

### Define a schema which is used to wire the relationships

```typescript
import { Schema } from 'knight-object-db'

let schema = {
    // the keys in the root schema object are names of tables (be aware of casing!)
    'knight': {
        // you need to define the id properties
        // this information will be used to determine if two objects are the same
        idProps: ['id'],

        relationships: {
            // here a many-to-one and one-to-many relationships
            // the keys are property names on the object

            // many-to-one
            'bestFriend': {
                manyToOne: true,
                thisId: 'bestFriendId',
                otherEntity: 'knight',
                otherId: 'id'
            },

            // one-to-many
            'knightsWhoThinkIAmTheirBestFriend': {
                oneToMany: true,
                thisId: 'id',
                otherEntity: 'knight',
                otherId: 'bestFriendId'
            },

            // one-to-one
            'address': {
                manyToOne: true,
                thisId: 'id',
                otherEntity: 'address',
                otherId: 'knightId'
            }
        },
    },

    'address': {
        columns: {
            'knight_id': 'knight_id',
            'street': 'street'
        },
        relationships: {
            'knight': {
                manyToOne: true,
                thisId: 'knight_id',
                otherEntity: 'knight',
                otherId: 'id',
            }
        }
    } as Schema
}
```

### Initializing the database

```typescript
let db = new ObjectDb(schema)
```

### Integrate objects into the database

Store a plain JavaScript object into the database. You will need to give the class either as string or as class function.

```typescript
let obj = {
    id: 1
    name: 'garz'
}

db.integrate('Knight', obj)
db.integrate(Knight, obj)

// the object is stored inside the property objects
db.objects == {
    'Knight': [ obj ]
}

// storing the object without a class name will store it as Object in the database
db.integrate(obj)

db.objects == {
    'Object': [ obj ]
}
```

Or you use an instance of a class.

```typescript
let knight = new Knight(1, 'garz')

db.integrate(knight)

// the instance of class Knight is stored inside the property objects
db.objects == {
    'Knight': [ knight ]
}
```

You can also give an array of objects.

```typescript
db.integrate([ new Knight(1), new Knight(2) ])
db.integrate(Knight, [{ id: 1 }, { id: 2 }])
db.integrate('Knight', [{ id: 1 }, { id: 2 }])
```

You can update an object by feeding another object which needs to have the same id as the object you wish to update. The object that is already inside the database will be updated and remain in place.

```typescript
let knight = new Knight(1, 'garz')
db.integrate(knight)

let updated = new Knight(1, 'René')
db.integrate(updated)

db.objects == {
    'Knight': [ knight ] // knight object still in place after updating
}
```

If the object comes with set relationships, the database will store them in their own array, while leaving the relationships in place. That means that the objects inside the database are still connected to each other.

```typescript
let garz = new Knight(1, 'garz')
garz.bestFriendId = 2

garzAddress = new Address('Jordan Street')
garzAddress.knightId = 1

let none = new Knight(1, 'none')

garz.address = garzAddress // assigned
garz.bestFriend = none // assigned
none.knightsWhoThinkIAmTheirBestFriend = [ garz ] // assigned
garzAddress.knight = garz // assigned

db.integrate(garz)

db.object = {
    'Knight': [ garz, none ],
    'Address': [ garzAddress ]
}
```

You can also integrate objects that do not have their relationships set. The database will wire them according to the schema.

```typescript
let garz = new Knight(1, 'garz')
garz.bestFriendId = 2 // best friend id is set

let garzAddress = new Address('Jordan Street')
garzAddress.knightId = 1 // knight id is set

let none = new Knight(2, 'none')

garz.bestFriend = undefined // unassigned
garz.address = undefined // unassigned
none.knightsWhoThinkIAmTheirBestFriend = undefined // unassigned
garzAddress.knight = undefined // unassigned

db.integrate(garz)
db.integrate(none)
db.integrate(garzAddress)

// after integrating the objects into the database they got fully wired

garz.bestFriend == none
garz.address == garzAddress
none.knightsWhoThinkIAmTheirBestFriend == [ garz ]
garzAddress.knight = garz
```

The database will return a `Changes` object, containing all the changes that were made to the database while integrating the given object.

```typescript
/* create an object */
let garz = new Knight(1, 'garz')
let changes = db.integrate(garz)

changes.changes == [
    {
        entityName: 'Knight',
        entity: garz, // the object which is stored inside the database
        method: { method: 'create' }
    }
]

/* update an object */
let updated = new Knight(1, 'René')
let changes = db.integrate(updated)

changes.changes == [
    {
        entityName: 'Knight',
        entity: garz, // the object which was already in the database
        method: { method: 'method', props: ['name'] }
    }
]
```

### Remove objects from the database

Removing an object will also unwire its relationships.

```typescript
let garz = new Knight(1, 'garz')
garz.bestFriendId = 2

garzAddress = new Address('Jordan Street')
garzAddress.knightId = 1

let none = new Knight(1, 'none')

garz.bestFriend = none // assigned
garz.address = garzAddress // assigned
none.knightsWhoThinkIAmTheirBestFriend = [ garz ] // assigned
garzAddress.knight = garz // assigned

db.integrate(garz)

let changes = db.remove(Knight, { id: 1 })

changes.changes == [
    {
        entityName: 'Knight',
        entity: garz,
        method: { method: 'delete' }
    }
]

// the database after removing
db.objects = {
    'Knight': [ none ],
    'Address': [ garzAddress ]
}

// the relationships after removing
garz.bestFriend = null
none.knightsWhoThinkIAmTheirBestFriend = []
garzAddress.knight == null

// but the ids are still there
garz.bestFriendId = 2
garzAddress.knightId = 1
```

You can also remove an object tree at once.

```typescript
let obj = {
    id: 1,
    bestFriend: {
        id: 2
    },
    address: {
        knightId: 1
    }
}

let changes = db.remove(Knight, obj)

changes.changes == [
    {
        entityName: 'Knight',
        entity: garz,
        method: { method: 'delete' }
    },
    {
        entityName: 'Knight',
        entity: none,
        method: { method: 'delete' }
    },
    {
        entityName: 'Address',
        entity: garzAddress,
        method: { method: 'delete' }
    }
]
```

Or an array of objects.

```typescript
db.remove([ new Knight(1), new Knight(2) ])
db.remove(Knight, [{ id: 1 }, { id: 2 }])
db.remove('Knight', [{ id: 1 }, { id: 2 }])
```

### Querying the database

The database implements the a querying API on the basis of the `Criteria` interface which is part of [knight-criteria](https://github.com/c0deritter/knight-criteria) package.

```typescript
/* returns all knights with the id 1 */
db.read(Knight, { id: 1 })
db.read('Knight', { id: 1 })

/* returns all knights which name starts with 'g' */
db.read(Knight, { name: { operator: 'LIKE', value: 'g%' }})
db.read('Knight', { name: { operator: 'LIKE', value: 'g%' }})
```

The returned objects are fully wired and ready to use. The database also ensures that the received objects will stay the same throughout the lifetime of the database.