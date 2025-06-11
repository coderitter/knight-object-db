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

export function idProps(schema: Schema, entityName: string, object: any) {
  let entity = schema[entityName]
  if (entity == undefined) {
    throw new Error(`Entity '${entityName}' not contained in schema`)
  }

  let newObject: any = {}

  for (let prop of entity.idProps) {
    newObject[prop] = object[prop]
  }

  return newObject
}

export function idAndRelationshipProps(schema: Schema, entityName: string, object: any) {
  let props = idAndRelationshipIdPropNames(schema, entityName)
  let newObject: any = {}

  for (let prop of props) {
    newObject[prop] = object[prop]
  }

  return newObject
}

export function checkSchema(schema: Schema, referenceObjects: any[]): string[] {
  const issues: string[] = []
  const entityNameToFoundProps: { [entityName: string]: string[] } = {}
  
  for (const referenceObj of referenceObjects) {
    if (! (typeof referenceObj == 'object')) {
      issues.push('Given reference object is not of type object')
      continue
    }

    const entityName = referenceObj.constructor.name
    let currentFoundProps = []

    if (! (entityName in schema)) {
      issues.push(`${entityName}: Could not find schema definition`)
      continue
    }

    const entityDefinition = schema[entityName]

    for (const idProp of entityDefinition.idProps) {
      if (! (idProp in referenceObj)) {
        issues.push(`${entityName}: Given reference object does not contain the id property with name '${idProp}'`)
      }
      else {
        currentFoundProps.push(idProp)
      }
    }

    if (entityDefinition.relationships) {
      for (const relationship of Object.keys(entityDefinition.relationships)) {
        if (! (relationship in referenceObj)) {
          issues.push(`${entityName}: Given reference object does not contain the relationship property with name '${relationship}'`)
        }
        else {
          currentFoundProps.push(relationship)
          const relationshipDefinition = entityDefinition.relationships[relationship]

          if (relationshipDefinition.manyToOne && relationshipDefinition.oneToMany) {
            issues.push(`${entityName}.${relationship}: Both 'manyToOne' and 'oneToMany' properties to be true while only one can be`)
          }
          else if (!relationshipDefinition.manyToOne && !relationshipDefinition.oneToMany) {
            issues.push(`${entityName}.${relationship}: Both 'manyToOne' and 'oneToMany' properties to be false while one must be true`)
          }

          if (relationshipDefinition.manyToOne) {
            if (! (typeof referenceObj[relationship] == 'object')) {
              issues.push(`${entityName}.${relationship}: The relationship is defined to be a many-to-one but the value of the property on the given reference object is not an object`)
            }
          }
          else if (relationshipDefinition.oneToMany) {
            if (! Array.isArray(referenceObj[relationship])) {
              issues.push(`${entityName}.${relationship}: The relationship is defined to be a one-to-many but the value of the property on the given reference object is not an array`)
            }
          }

          if (! (relationshipDefinition.thisId in referenceObj)) {
            issues.push(`${entityName}.${relationship}: The in 'thisId' defined property name '${relationshipDefinition.thisId}' is not contained in the given reference object`)
          }
          else {
            currentFoundProps.push(relationshipDefinition.thisId)
          }

          if (! (relationshipDefinition.otherEntity in schema)) {
            issues.push(`${entityName}.${relationship}: The in 'otherEntity' defined entity name '${relationshipDefinition.otherEntity}' is not contained in the schema`)
          }
          else {
            let otherReferenceObjFound = false
            for (const otherReferenceObj of referenceObjects) {
              if (typeof otherReferenceObj == 'object' && otherReferenceObj.constructor.name == relationshipDefinition.otherEntity) {
                otherReferenceObjFound = true

                if (! (relationshipDefinition.otherId in otherReferenceObj)) {
                  issues.push(`${entityName}.${relationship}: The in 'otherId' defined property name '${relationshipDefinition.otherId}' is not contained in the given other reference object '${relationshipDefinition.otherEntity}'`)
                }
              }
            }
          }
        }
      }
    }

    if (! (entityName in entityNameToFoundProps)) {
      entityNameToFoundProps[entityName] = currentFoundProps
    }
    else {
      entityNameToFoundProps[entityName].push(...currentFoundProps)
    }
  }

  for (const entityName of Object.keys(schema)) {
    if (! referenceObjects.find(referenceObj => typeof referenceObj == 'object' && referenceObj.constructor.name == entityName)) {
      issues.push(`${entityName}: No reference object given`)
    }
  }

  for (const referenceObj of referenceObjects) {
    if (typeof referenceObj == 'object' && referenceObj.constructor.name in schema) {
      const entityName = referenceObj.constructor.name
      const allProps = Object.keys(referenceObj)
      const foundProps = entityNameToFoundProps[entityName]
      const remainingProps = allProps.filter(prop => ! foundProps.includes(prop))

      if (remainingProps.length > 0) {
        issues.push(`${entityName}: The given reference objects defines further properties which were not mentioned in the schema: ${remainingProps.join(', ')}`)
      }
    }
  }

  return issues
}