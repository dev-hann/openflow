export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  enum?: string[];
  items?: JsonSchemaProperty;
}
