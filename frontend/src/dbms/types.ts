export interface DbmsOverview {
  dialect: string;
  database_version: string;
  database_size: string;
  total_tables: number;
  total_entities: number;
  total_relationships: number;
  total_attributes: number;
  total_primary_keys: number;
  total_foreign_keys: number;
  total_indexes: number;
  total_constraints: number;
  total_views: number;
  total_triggers: number;
  total_functions: number;
  schema_name: string;
}

export interface ColumnMetadata {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string | null;
  autoincrement: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_info?: {
    referred_table: string;
    referred_columns: string[];
    name?: string;
    ondelete?: string;
    onupdate?: string;
  } | null;
}

export interface TableMetadata {
  name: string;
  description: string;
  row_count: number;
  columns: ColumnMetadata[];
  primary_key: {
    name: string | null;
    columns: string[];
  };
  foreign_keys: Array<{
    name: string;
    constrained_columns: string[];
    referred_table: string;
    referred_columns: string[];
    options?: {
      ondelete?: string;
      onupdate?: string;
    };
  }>;
  unique_constraints: Array<{
    name: string;
    column_names: string[];
  }>;
  check_constraints: Array<{
    name: string;
    sqltext: string;
  }>;
  indexes: Array<{
    name: string;
    column_names: string[];
    unique: boolean;
  }>;
  referencing_tables: Array<{
    from_table: string;
    from_columns: string[];
    to_columns: string[];
    constraint_name?: string;
  }>;
  sample_rows?: Array<Record<string, any>>;
}

export interface ChenEntity {
  id: string;
  name: string;
  table_name: string;
  is_weak: boolean;
  category: string;
  attributes: Array<{
    id: string;
    name: string;
    data_type: string;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    is_derived: boolean;
    is_multivalued: boolean;
    nullable: boolean;
  }>;
  x?: number;
  y?: number;
}

export interface ChenRelationship {
  id: string;
  name: string;
  source_entity: string;
  target_entity: string;
  cardinality: "1:1" | "1:N" | "M:N";
  is_identifying: boolean;
  source_participation: "total" | "partial";
  target_participation: "total" | "partial";
  foreign_key_columns: string[];
  referred_columns: string[];
  constraint_name?: string;
}

export interface ChenErModel {
  entities: ChenEntity[];
  relationships: ChenRelationship[];
  legend: Record<string, string>;
}

export interface RelationalSchemaItem {
  table_name: string;
  formal_notation: string;
  attributes: Array<{
    name: string;
    type: string;
    markers: string[];
    nullable: boolean;
    is_pk: boolean;
    is_fk: boolean;
    references?: string;
  }>;
  primary_key: string[];
  foreign_keys: Array<{
    column: string[];
    target_table: string;
    target_column: string[];
    sql_join_condition: string;
  }>;
}

export interface SqlExecutionResult {
  columns: string[];
  rows: string[][];
  row_count: number;
  duration_ms: number;
  query: string;
  explain_plan?: string;
}

export interface TableNormalizationItem {
  table_name: string;
  columns: string[];
  primary_key: string[];
  candidate_keys: string[][];
  functional_dependencies: Array<{
    lhs: string[];
    rhs: string[];
    basis: string;
  }>;
  highest_normal_form: string;
  is_bcnf: boolean;
  justification: string;
}

export interface DbmsActivity {
  recent_audits: Array<{
    id: string;
    actor: string;
    action: string;
    scope: string;
    target: string;
    created_at: string;
  }>;
  recent_incidents: Array<{
    id: string;
    case_id: string;
    category: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
  migration_history: Array<{
    version_num: string;
  }>;
}

