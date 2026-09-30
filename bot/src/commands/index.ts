import help from './help.js'
import info from './info.js'
import ping from './ping.js'

export const commands = [help, info, ping]
export const commandsByName = new Map(commands.map(command => [command.data.name, command]))
