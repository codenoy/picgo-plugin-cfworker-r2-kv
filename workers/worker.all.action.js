/* eslint-disable no-fallthrough */
/* eslint-disable no-case-declarations */
function Authorization (request, env) {
  const authHeader = request.headers.get('Authorization')
  let token
  if (!authHeader || authHeader.indexOf('Bearer ') === -1 || !(token = authHeader.split('Bearer ')[1]) || token !== env.token) {
    return new Response('UnAuthrization', { status: 401 })
  }
  return true
}
export default {
  async fetch (request, env) {
    const url = new URL(request.url)
    const key = url.pathname.slice(1)
    switch (request.method) {
      case 'PUT':
        if (Authorization(request, env)) {
          await env.bucket.put(key, request.body)
          return new Response(`Put ${key} successfully!`)
        }
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
      // case 'DELETE':
      //   await env.imgurl.delete(key);
      //   return new Response('Deleted!');
      default:
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            Allow: 'PUT, GET, DELETE'
          }
        })
    }
  }
}
