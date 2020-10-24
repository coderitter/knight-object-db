export interface Schema {
  [entity: string]: Entity
}

export interface Entity {
  idProps: string[]
  relationships?: {
    [relationshipName: string]: Relationship
  }
}

export interface Relationship {
  manyToOne?: boolean
  oneToMany?: boolean
  thisId: string
  otherEntity: string
  otherId: string
  otherRelationship?: string
}

export function idAndRelationshipIdPropNames(schema: Schema, entityName: string): string[] {
  let entity = schema[entityName]
  if (entity == undefined) {
    throw new Error(`Entity '${entityName} not contained in schema`)
  }

  let props = entity.idProps.slice()

  if (entity.relationships != undefined) {
    for (let relationshipName of Object.keys(entity.relationships)) {
      let relationship = entity.relationships[relationshipName]
      props.push(relationship.thisId)
    }
  }

  return props
}

export function idAndRelationshipIdProps(schema: Schema, entityName: string, object: any) {
  let props = idAndRelationshipIdPropNames(schema, entityName)
  let newObject: any = {}

  for (let prop of props) {
    newObject[prop] = object[prop]
  }

  return newObject
}