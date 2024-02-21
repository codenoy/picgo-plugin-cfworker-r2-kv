const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
})
const { PicGo } = require('picgo')
const cfKvBackupPlugin = require('../src/index')
const picgo = new PicGo() // 将使用默认的配置文件：~/.picgo/config.json
// 添加一个uploader实例用作上传
picgo.setConfig({
  // 其它配置
  picgoPlugins: {
    'picgo-plugin-cloudflare-kv-backup': true
  },
  'picgo-plugin-cloudflare-kv-backup': {
    accountId: process.env.accountId,
    namespaceId: process.env.namespaceId,
    token: process.env.token,
    overwrite: process.env.overwrite,
    backup: process.env.backup
  },
  picBed: {
    current: 'aliyun',
    uploader: 'aliyun',
    aliyun: {
      accessKeyId: process.env.accessKeyId,
      accessKeySecret: process.env.accessKeySecret,
      /** 存储空间名 */
      bucket: process.env.bucket,
      /** 存储区域代号 */
      area: process.env.area,
      /** 自定义存储路径 */
      path: process.env.path,
      /** 自定义域名，注意要加 `http://` 或者 `https://` */
      customUrl: process.env.customUrl || '',
      /** 针对图片的一些后缀处理参数 PicGo 2.2.0+ PicGo-Core 1.4.0+ */
      options: process.env.options || ''
    }
  }

})
// 注册本插件
picgo.use(cfKvBackupPlugin, 'cloudflare-kv-backup')
// 上传具体路径下的图片
picgo
  .upload([path.resolve(__dirname, './picgo.png')])
  .then((res) => {
    console.log('----response----')
    console.log(res)
    console.log('----------------')
  }).catch(err => {
    console.log('----error----')
    console.log(err)
    console.log('--------')
  })
