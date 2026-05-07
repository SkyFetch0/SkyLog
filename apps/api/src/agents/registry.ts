import {
  APACHE_SECURITY_PROMPT,
  APACHE_SECURITY_OUTPUT_SCHEMA,
} from './prompts/specialists/apache-security.js'
import {
  APACHE_TRAFFIC_PROMPT,
  APACHE_TRAFFIC_OUTPUT_SCHEMA,
} from './prompts/specialists/apache-traffic.js'
import {
  MYSQL_PERFORMANCE_PROMPT,
  MYSQL_PERFORMANCE_OUTPUT_SCHEMA,
} from './prompts/specialists/mysql-performance.js'
import {
  MYSQL_ERRORS_PROMPT,
  MYSQL_ERRORS_OUTPUT_SCHEMA,
} from './prompts/specialists/mysql-errors.js'
import {
  NGINX_SECURITY_PROMPT,
  NGINX_SECURITY_OUTPUT_SCHEMA,
} from './prompts/specialists/nginx-security.js'
import {
  NGINX_TRAFFIC_PROMPT,
  NGINX_TRAFFIC_OUTPUT_SCHEMA,
} from './prompts/specialists/nginx-traffic.js'
import {
  GENERIC_ERROR_PROMPT,
  GENERIC_ERROR_OUTPUT_SCHEMA,
} from './prompts/specialists/generic-error.js'
import { ORCHESTRATOR_SYSTEM_PROMPT } from './prompts/orchestrator.js'

export type SpecialistRole =
  | 'apache_security'
  | 'apache_traffic'
  | 'nginx_security'
  | 'nginx_traffic'
  | 'mysql_performance'
  | 'mysql_errors'
  | 'generic_error'

const SPECIALIST_REGISTRY: Record<
  SpecialistRole,
  { prompt: string; outputSchema: Record<string, unknown> }
> = {
  apache_security: { prompt: APACHE_SECURITY_PROMPT, outputSchema: APACHE_SECURITY_OUTPUT_SCHEMA },
  apache_traffic:  { prompt: APACHE_TRAFFIC_PROMPT,  outputSchema: APACHE_TRAFFIC_OUTPUT_SCHEMA  },
  nginx_security:  { prompt: NGINX_SECURITY_PROMPT,  outputSchema: NGINX_SECURITY_OUTPUT_SCHEMA  },
  nginx_traffic:   { prompt: NGINX_TRAFFIC_PROMPT,   outputSchema: NGINX_TRAFFIC_OUTPUT_SCHEMA   },
  mysql_performance: { prompt: MYSQL_PERFORMANCE_PROMPT, outputSchema: MYSQL_PERFORMANCE_OUTPUT_SCHEMA },
  mysql_errors:    { prompt: MYSQL_ERRORS_PROMPT,    outputSchema: MYSQL_ERRORS_OUTPUT_SCHEMA    },
  generic_error:   { prompt: GENERIC_ERROR_PROMPT,   outputSchema: GENERIC_ERROR_OUTPUT_SCHEMA   },
}

export function getSpecialistPrompt(role: string): string {
  return SPECIALIST_REGISTRY[role as SpecialistRole]?.prompt ?? GENERIC_ERROR_PROMPT
}

export function getSpecialistOutputSchema(role: string): Record<string, unknown> {
  return SPECIALIST_REGISTRY[role as SpecialistRole]?.outputSchema ?? GENERIC_ERROR_OUTPUT_SCHEMA
}

export function listAvailableSpecialists(): SpecialistRole[] {
  return Object.keys(SPECIALIST_REGISTRY) as SpecialistRole[]
}

export function getOrchestratorPrompt(): string {
  return ORCHESTRATOR_SYSTEM_PROMPT
}