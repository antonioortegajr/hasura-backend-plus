import { Request, Response } from 'express'
import { asyncWrapper } from '@shared/helpers'
import { getAWSOptions } from '../../shared/helpers'
import Boom from '@hapi/boom'
import AWS from 'aws-sdk'

async function get_file(req: Request, res: Response): Promise<void> {
  const key = `${req.params[0]}`
  const token = req.query.token

  // get file info
  const aws_options = getAWSOptions()
  const s3 = new AWS.S3(aws_options)

  const params = {
    Bucket: process.env.S3_BUCKET as string,
    Key: key
  }

  let data

  try {
    data = await s3.headObject(params).promise()
  } catch (e) {
    if (e) {
      throw Boom.forbidden()
    }
  }

  if (!data?.Metadata) {
    throw Boom.forbidden()
  }

  if (data.Metadata.token !== token) {
    throw Boom.forbidden()
  }

  const stream = s3.getObject(params).createReadStream()

  // forward errors
  stream.on('error', function error(err) {
    console.error(err)
    throw Boom.badImplementation()
  })

  //Add the content type to the response (it's not propagated from the S3 SDK)
  res.set('Content-Type', data.ContentType)
  res.set('Content-Length', data.ContentLength?.toString())
  res.set('Last-Modified', data.LastModified?.toString())
  res.set('Content-Disposition', `inline;`)
  res.set('Cache-Control', 'public, max-age=31557600')
  res.set('ETag', data.ETag)

  //Pipe the s3 object to the response
  stream.pipe(res)
}

export default asyncWrapper(get_file)
