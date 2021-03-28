import RawClient from "../client"
import PetalsWS from "../utils/ws"

export default class Shard {
    id: number
    ws: PetalsWS
    bot: RawClient
    constructor(id: number, ws: PetalsWS, bot: RawClient) {
        this.id = id
        this.ws = ws
        this.bot = bot
    }
    restart() {
        this.ws.close(1000)
        this.bot.emit("shard.close", this.id)
        this.ws = new PetalsWS("wss://gateway.discord.gg/?v=8&encoding=json", this.bot, this.id, this.bot.opts.shardCount as number)
        this.bot.shards.set(this.id, this)
    }
    get latency() {
        return this.ws.latency
    }
}