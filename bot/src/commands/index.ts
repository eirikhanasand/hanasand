import help from './help.js'
import info from './info.js'
import ping from './ping.js'
import tickets from './tickets.js'

export const commands = [help, info, ping, tickets]
export const commandsByName = new Map(commands.map(command => [command.data.name, command]))
