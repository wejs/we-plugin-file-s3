/**
 * Amazon AWS S3 storage plugin main file
 *
 * see http://wejs.org/docs/we/plugin
 */
const uuid = require('uuid'),
  request = require('request'),
  gm = require('gm'),
  path = require('path'),
  fs = require('fs'),
  multerS3 = require('multer-s3');

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  // set plugin configs
  plugin.setConfigs({
    // apiKeys: {
    //   s3: {
    //     bucket_name: '',
    //   }
    // },

    upload: {
      storages: {
        s3: {
          isLocalStorage: false,
          getStorage(we) {
            if (!we.config.apiKeys.s3) {
              console.log('configure your AWS S3 api keys in: we.config.apiKeys.s3');
              we.exit(process.exit);
            }

            // see all options in: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor_details
            plugin.s3 = new plugin.we.plugins['we-plugin-aws'].AWS.S3(we.config.apiKeys.s3);

            plugin.storage = multerS3({
              s3: plugin.s3,
              bucket: we.config.apiKeys.s3.bucket_name,
              acl: 'public-read',

              contentType: (we.config.apiKeys.s3.contentType || multerS3.AUTO_CONTENT_TYPE),

              metadata: this.fileToUploadMetadata,

              key(req, file, cb) {
                cb(null, Date.now() + '_' + uuid.v1()) ;
              }
            });

            return plugin.storage;
          },

          /**
           * Send one file to user
           *
           * TODO add support for image resize:
           *
           * @param  {Object} file
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile(file, req, res, style) {
            if (!style) style = 'original';
            // send to s3 file
            res.redirect( file.urls[ style ] );
          },

          /**
           * Default destroy file event:
           *
           * @param  {Object}   file file data
           * @param  {Function} done callback
           */
          destroyFile(file, done) {
            const keys = [ { Key: file.name } ];

            if (file.extraData && file.extraData.keys) {
              // get other formats:
              for(let format in file.extraData.keys) {
                keys.push({
                  Key: file.extraData.keys[format]
                });
              }
            }

            plugin.s3.deleteObjects({
              Bucket: plugin.we.config.apiKeys.s3.bucket_name,
              Delete: { Objects: keys }
            }, (err, data)=> {
              if (err) {
                plugin.we.log.error('error on delete image from AWS S3:', data);
              }

              done(err, data);
            });
          },

          /**
           * Override this function to send custom file metadata on upload to S3
           *
           * @param  {Object}   req  Current user request
           * @param  {Object}   file File metadata to be uploaded
           * @param  {Function} cb   callback
           */
          fileToUploadMetadata(req, file, cb) {
            cb(null);
          },

          /**
           * Method for get url from file
           *
           * @param  {String} format Ex: thumbnail
           * @param  {Object} file   Uploaded file data
           * @return {String}        url
           */
          getUrlFromFile(format, file) {
            if (!file.extraData) {
              file.extraData = {
                public_id: file.public_id,
                bucket: file.bucket,
                acl: file.acl,
                storageClass: file.storageClass,
                keys: { original: file.key }
              };
            }

            // resolve other data:
            file.name = file.key;
            file.size = file.size;
            file.mime = file.mimetype;

            // get extension:
            const fParts = file.originalname.split('.');
            file.extension = '.'+fParts[fParts.length-1];

            return file.location;
          },

          /**
           * Make unique file name
           *
           * @param  {Object} req
           * @param  {Object} file
           * @return {String}      new file name
           */
          filename() {
            return Date.now() + '_' + uuid.v1();
          },

          /**
           * Generate all image styles for one uploaded image
           *
           * TODO add support for amazon lambda
           *
           * @param  {Object}   file Image data
           * @param  {Function} done Callback
           */
          generateImageStyles(file, done) {
            const we = plugin.we,
              styles = we.config.upload.image.avaibleStyles,
              styleCfgs = plugin.we.config.upload.image.styles;

            // reload original file to stream to new file versions:
            const originalImageStream = request(file.urls.original);

            we.utils.async.each(styles, function resizeEach(style, next) {
              const width = styleCfgs[style].width,
                height = styleCfgs[style].heigth,
                tempFile = path.resolve(process.cwd(), 'files' , 's3_'+file.name+'_'+style);

              // resize the image from stream:
              gm(originalImageStream)
              .resize(width, height, '^')
              .gravity('Center')
              .crop(width, height)
              .write(tempFile, (err)=> {
                if (err) {
                  we.log.error('Error on resize S3 image:', err);
                  return done(err);
                }

                // save the file in s3 storage:
                plugin.s3.upload({
                  Bucket: we.config.apiKeys.s3.bucket_name,
                  Key: style + '/' + file.name,
                  Body: fs.createReadStream(tempFile),
                  contentType: file.mime
                }, (err, data)=> {
                  if (err) {
                    we.log.error('Error on save image resized version in S3', err);
                  } else {
                    const extraData = file.extraData;

                    extraData.keys[style] = data.key;
                    file.extraData = extraData;

                    file.urls[style] = data.Location;
                  }

                  next(err);
                });
              });

            }, done);
          }
        }
      }
    }
  });

  /**
   * Plugin fast loader
   *
   * Defined for faster project bootstrap
   *
   * @param  {Object}   we
   * @param  {Function} done callback
   */
  plugin.fastLoader = function fastLoader(we, done) {
    done();
  };

  return plugin;
};