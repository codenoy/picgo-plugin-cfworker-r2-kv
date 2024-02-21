const path = require('path')
const crypto = require('crypto')
const pluginName = require('../package.json').name
/**
 * @param {import('picgo').PicGo} ctx
 */
const pluginConfig = ctx => {
  let config = ctx.getConfig(pluginName)
  const uploaderConfig = ctx.getConfig('picBed')
  const uploaderList = Object.keys(uploaderConfig).filter(item => !['current', 'uploader', 'list', 'transformer'].includes(item))
  if (!config) {
    config = {}
  }
  return [{
    name: 'accountId',
    type: 'password',
    alias: 'accountId',
    default: config.accountId || '',
    message: '用户ID',
    required: true
  }, {
    name: 'namespaceId',
    type: 'password',
    alias: 'namespaceId',
    default: config.namespaceId || '',
    message: '命名空间ID',
    required: true
  },
  {
    name: 'token',
    type: 'password',
    alias: 'token',
    default: config.token || '',
    message: '用户token或apiKey',
    required: true
  },
  {
    name: 'overwrite',
    type: 'confirm',
    alias: '是否添加后缀',
    default: config.overwrite || true,
    message: '图片名称后添加唯一后缀, 确保key不重名, 不会覆盖之前记录',
    required: true
  },
  {
    name: 'backup',
    type: 'list',
    alias: '备份源',
    choices: ['', ...uploaderList],
    default: config.backup || '',
    message: '选择备份地址',
    required: false
  }
  ]
}
/**
 * @param {import('picgo').PicGo} ctx
 */
module.exports = (ctx) => {
  const register = () => {
    // 在用户上传流程之外, 保留初始上传图片的内容, 如果用户带有压缩插件, 依旧能够保留压缩传前的数据
    ctx.helper.beforeTransformPlugins.register(pluginName, {
      async handle (ctx) {
        const backupLoaderConfig = ctx.getConfig(pluginName)
        if (!backupLoaderConfig) {
          throw new Error(pluginName + ' has no config')
        }
        // transformer
        const type = ctx.getConfig('picBed.transformer') || 'path'
        let currentTransformer = type
        let transformer = ctx.helper.transformer.get(type)
        if (!transformer) {
          transformer = ctx.helper.transformer.get('path')
          currentTransformer = 'path'
          ctx.log.warn(`Can't find transformer - ${type}, switch to default transformer - path`)
        }
        ctx.log.info(`Transforming... Current transformer is [${currentTransformer}]`)
        await transformer.handle(ctx)
        ctx._output = ctx.output.map(img => ({ ...img }))
        ctx.output = []
        return ctx
      }
    })
    // 在用户上传流程中, 处理图片名称问题, 防止因为同名图片导致cf的kv被覆盖刷新
    ctx.helper.beforeUploadPlugins.register(pluginName, {
      async handle (ctx) {
        const backupLoaderConfig = ctx.getConfig(pluginName)
        if (!backupLoaderConfig) {
          throw new Error(pluginName + ' has no config')
        }

        ctx.output = ctx.output.map(img => {
          const name = path.parse(img.fileName).name
          if (!backupLoaderConfig.overwrite) {
            return {
              ...img,
              originalName: img.fileName
            }
          }
          // 重写用户fileName
          return {
            ...img,
            originalName: img.fileName,
            fileName: name + Date.now() + crypto.randomBytes(4).toString('hex') + img.extname
          }
        })
        return ctx
      }
    })
    ctx.helper.afterUploadPlugins.register(pluginName, {
      async handle (ctx) {
        console.log('input:', ctx.input)
        console.log('初始_output:', ctx._output)
        console.log('用户output:', ctx.output)
        const backupLoaderConfig = ctx.getConfig(pluginName)
        if (!backupLoaderConfig) {
          throw new Error('cloudflare-kv-backup has no config')
        }
        const backup = backupLoaderConfig.backup
        // 没设置备份, 直接返回
        if (!backup) {
          return ctx
        }
        const uploader = ctx.helper.uploader.get(backup)
        if (!uploader) {
          throw new Error(`Can't find uploader - ${backup}`)
        }
        // 缓存用户上传的output
        const output = ctx.output.map(img => ({ ...img }))
        // 恢复上传前output, 重新上传初始版本
        ctx.output = ctx._output.map(img => {
          const name = path.parse(img.fileName).name
          return {
            ...img,
            originalName: img.fileName,
            fileName: name + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + img.extname
          }
        })
        await uploader.handle(ctx)
        for (const outputImg of ctx.output) {
          outputImg.type = backup
        }
        const { accountId, namespaceId, token } = backupLoaderConfig
        const cfkvUrlPrefix = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`
        try {
          await ctx.request({
            url: cfkvUrlPrefix + '/bulk',
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`
            },
            data: ctx.output.map(img => {
              const value = img.imgUrl
              const key = output.find(userImg => userImg.originalName === img.originalName).imgUrl
              return {
                key,
                value
              }
            })
          })
        } catch (err) {
          ctx.log.error(err)
        }
        console.log('备份ouput:', ctx.output)
        ctx.output = output
        // 存储kv
        return ctx
      }
    })
  }
  return {
    register,
    config: pluginConfig
  }
}
