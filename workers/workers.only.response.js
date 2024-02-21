/* eslint-disable no-case-declarations */
export default {
  async fetch (request, env) {
    const url = new URL(request.url)
    const key = url.pathname.slice(1)
    switch (request.method) {
      case 'GET':
        const object = await env.imgurl.get(key)
        if (object === null) {
          return new Response('Not Found', { status: 404 })
        }
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        return new Response(object.body, {
          headers
        })
    }
  }
}
