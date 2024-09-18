#! /usr/bin/env node

import { lightCyan, lightGreen, lightRed, lightYellow } from 'kolorist'
import fs from 'node:fs/promises'
import path from 'node:path'
import prompts from 'prompts'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const args = yargs(hideBin(process.argv))
  .scriptName('dirkill')
  .usage('$0 <dir_name> [-s <skip>]')
  .example('$0 .idea', 'Remove .idea directories recursively')
  .alias('h', 'help')
  .alias('v', 'version')
  .option('s', {
    alias: 'skip',
    default: 'node_modules',
    describe: 'Skip directories',
    type: 'string',
  })
  .parse()

const skipDirNames = args.skip.split(',')
let targetDirName = args._[0]

if (!targetDirName) {
  const { dirNameChecker } = await prompts(
    {
      type: 'text',
      name: 'dirNameChecker',
      message: 'Input directory name to remove',
    },
    {
      onCancel: () => {
        console.log(lightYellow('Bye!'))
      },
    },
  )
  if (dirNameChecker) {
    targetDirName = dirNameChecker
  } else {
    process.exit(1)
  }
}

console.log(lightYellow(`Start scanning directory: ${targetDirName}`))
const targetDirPaths = await findDirectories()

if (!targetDirPaths.length) {
  console.log(lightYellow(`Can't find directory: ${targetDirName}`))
  process.exit(1)
}

targetDirPaths.forEach(dirPath => {
  console.log(lightCyan(dirPath))
})

const { confirmed } = await prompts({
  type: 'confirm',
  name: 'confirmed',
  initial: true,
  message: 'Confirm to remove?',
})

if (confirmed) {
  const tasks = targetDirPaths.map(p => fs.rm(p, { recursive: true }))
  const values = await Promise.allSettled(tasks)

  const failures = []
  values.forEach((item, index) => {
    if (item.status === 'rejected') {
      failures.push({
        path: targetDirPaths[index],
        reason: item.reason,
      })
    }
  })
  if (failures.length) {
    console.log(lightRed('Errors:'))
    failures.forEach(item => {
      console.log(' ', lightRed(item.reason?.message))
    })
  } else {
    console.log(lightGreen('Removed successfully!'))
  }
} else {
  console.log(lightGreen('Bye!'))
  process.exit(1)
}

/**
 * ===============================================================
 */

async function findDirectories(readPath = process.cwd(), targetDirPaths = []) {
  try {
    const direntList = await fs.readdir(readPath, { withFileTypes: true })

    for (const dirent of direntList) {
      if (!dirent.isDirectory()) continue
      if (skipDirNames.includes(dirent.name)) continue

      const dirPath = path.join(readPath, dirent.name)
      if (dirent.name === targetDirName) {
        targetDirPaths.push(dirPath)
      } else {
        await findDirectories(dirPath, targetDirPaths)
      }
    }
    return targetDirPaths
  } catch (err) {
    console.error(err)
    return []
  }
}
