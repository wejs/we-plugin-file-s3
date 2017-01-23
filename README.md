# We.js S3 file storage plugin

Add AWS S3 storage option for we.js file plugin

## Requirements:

- GraficsMagic - http://www.graphicsmagick.org/ 
  For image resize

## Installation:

```sh
we i we-plugin-file-s3
```

## Api

See **wejs/we-plugin-file**

## Configuration:

**config/local.js** file:

```js
  // ....
  apiKeys: {
    // configure AWS:
    AWS: {
      region: 'youregion',
      accessKeyId: 'yourclientkey',
      secretAccessKey: 'yoursecretkey',
    },
    //  Configure S3:
    s3: {
      bucket_name: 'bconext',
      // // acl: ''
    }
  },
  // ....
```

## Roadmap 

- Add support for resize images in amazon lambda

## Links

> * We.js site: http://wejs.org

## Copyright and license

Copyright Alberto Souza <contato@albertosouza.net> and contributors , under [the MIT license](https://github.com/wejs/we-core/blob/master/LICENSE.md).