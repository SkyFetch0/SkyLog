import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'

// TODO: inject DB client via fastify.decorate
const logsRoute: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 500, default: 100 })),
          offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
          level: Type.Optional(
            Type.Union([
              Type.Literal('trace'),
              Type.Literal('debug'),
              Type.Literal('info'),
              Type.Literal('warn'),
              Type.Literal('error'),
              Type.Literal('fatal'),
            ]),
          ),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(Type.Any()),
            meta: Type.Object({ total: Type.Number() }),
          }),
        },
      },
    },
    async (_req, _reply) => {
      // TODO: query postgres
      return { data: [], meta: { total: 0 } }
    },
  )
}

export default logsRoute