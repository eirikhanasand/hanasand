import assert from 'node:assert/strict'
import { parseGitInput } from '../src/handlers/ai/importRepository.ts'

const forgejo = parseGitInput('git.hanasand.com/eirikhanasand/hanasand.git')
assert.equal(forgejo.host, 'git.hanasand.com')
assert.equal(forgejo.fullName, 'git.hanasand.com/eirikhanasand/hanasand')
assert.equal(forgejo.repo, 'hanasand')
assert.equal(forgejo.repositoryUrl, 'https://git.hanasand.com/eirikhanasand/hanasand.git')
assert.equal(forgejo.sourcePath, '')
assert.equal(forgejo.isGitHub, false)

const gitlab = parseGitInput('https://gitlab.com/group/subgroup/project.git#develop:apps/web')
assert.equal(gitlab.host, 'gitlab.com')
assert.equal(gitlab.fullName, 'gitlab.com/group/subgroup/project')
assert.equal(gitlab.repositoryUrl, 'https://gitlab.com/group/subgroup/project.git')
assert.equal(gitlab.branch, 'develop')
assert.equal(gitlab.sourcePath, 'apps/web')
assert.equal(gitlab.isGitHub, false)

const github = parseGitInput('eirikhanasand/hanasand#main:frontend')
assert.equal(github.host, 'github.com')
assert.equal(github.fullName, 'eirikhanasand/hanasand')
assert.equal(github.repositoryUrl, 'https://github.com/eirikhanasand/hanasand.git')
assert.equal(github.branch, 'main')
assert.equal(github.sourcePath, 'frontend')
assert.equal(github.isGitHub, true)

const githubSsh = parseGitInput('git@github.com:eirikhanasand/hanasand.git')
assert.equal(githubSsh.host, 'github.com')
assert.equal(githubSsh.fullName, 'eirikhanasand/hanasand')
assert.equal(githubSsh.repositoryUrl, 'https://github.com/eirikhanasand/hanasand.git')
assert.equal(githubSsh.sourcePath, '')
assert.equal(githubSsh.webBaseUrl, 'https://github.com/eirikhanasand/hanasand')
assert.equal(githubSsh.isGitHub, true)

console.log('git import parser smoke passed')
