import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Conversations } from './collections/Conversations'
import { Messages } from './collections/Messages'
import { Follows } from './collections/social/Follows'
import { Posts } from './collections/social/Posts'
import { Reactions } from './collections/social/Reactions'
import { Comments } from './collections/social/Comments'
import { Notifications } from './collections/social/Notifications'
import { Stories } from './collections/social/Stories'
import { Reels } from './collections/social/Reels'
import { startStoriesCleanupJob } from './lib/story-cleanup'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Conversations,
    Messages,
    Follows,
    Posts,
    Stories,
    Reels,
    Reactions,
    Comments,
    Notifications,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  onInit: async (payload) => {
    startStoriesCleanupJob(payload)
  },
  plugins: [],
})
