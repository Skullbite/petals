import Base from "./base"
import { Guild } from "./guild"
import Role from "./role"
import { Member, User } from "./user"
import * as c from "./channel"
import type RawClient from "../client"
import type PetalsFile from "../utils/file"
import Embed from "./embed"
import Emoji from "./emoji"
import FlagHandler from "../utils/flagcalc"

const messageFlags = {
    CROSSPOSTED: 1 << 0,
    IS_CROSSPOST: 1 << 1,
    SUPPRESS_EMBEDS: 1 << 2,
    SOURCE_MESSAGE_DELETED: 1 << 3,
    URGENT: 1 << 4
}
class Attachment {
    fileName: string
    proxyURL: string
    fileURL: string
    fileSize: number
    constructor(data) {
        const { filename, proxy_url, url, size } = data
        this.fileName = filename
        this.proxyURL = proxy_url
        this.fileURL = url
        this.fileSize = size
    }
}

export type MessageOptions =
    {
        content?: string,
        tts?: boolean,
        embed?: Embed,
        file?: PetalsFile,
        nonce?: string | number,
        allowed_mentions?: { 
            parse?: "everyone" | "roles" | "users"[], 
            users?: string[], 
            roles?: string[] 
        }
    } | string

export default class Message extends Base {
    referenceMessage?: Message
    pinned: boolean
    mentions: string[]
    roleMentions: Role[]
    embeds: Embed[]
    flags: FlagHandler
    content?: string
    author?: Member | User
    attachments: Attachment[]
    guild?: Guild
    channel: c.AnyTextable
    referencedMessage?: Message
    editedTimestamp?: Date
    type: string
    webhookID?: string
    constructor(data, bot: RawClient) {
        super(data.id, bot)
        const {
            referenced_message,
            edited_timestamp,
            type,
            content,
            channel_id,
            attachments,
            embeds,
            webhook_id,
            guild_id,
            flags
        } = data
        const author = guild_id ? { ...data.member, user: data.author, guild_id: guild_id } : data.author
        this.guild = this._bot.guilds.get(guild_id)
        this.content = content
        this.webhookID = webhook_id
        this.attachments = attachments.map(a => new Attachment(a))
        this.embeds = embeds.map(d => new Embed(d))
        this.author = this.guild ? new Member(author, this._bot) : new User(author, this._bot)
        if (this.guild) {
            this.author = new Member(author, this._bot)
            this.channel = this.guild.channels.get(channel_id) as c.AnyTextable
            if (!this.channel) this._bot.fetchChannel(channel_id).then(d => this.channel = d as c.AnyTextable)
        }
        else {
            this.author = new User(author, this._bot)
            this.channel = this._bot.channels.get(channel_id) as c.AnyTextable
            if (!this.channel) {
                const newChannel = new c.DMChannel({ id: channel_id, recipients: [data.author] }, this._bot)
                this._bot.channels.set(this.author.id, newChannel)
                this.channel = newChannel
            }
        }
        this.flags = new FlagHandler(flags, messageFlags)
        this.editedTimestamp = edited_timestamp ? new Date(edited_timestamp) : undefined
        this.referenceMessage = referenced_message ? new Message(referenced_message, this._bot) : undefined
        switch (type) {
        case 0:
            this.type = "DEFAULT"
            break
        case 1:
            this.type = "RECIPIENT_ADD"
            break
        case 2:
            this.type = "RECIPIENT_REMOVE"
            break
        case 3:
            this.type = "CALL"
            break
        case 4:
            this.type = "CHANNEL_NAME_CHANGE"
            break
        case 5:
            this.type = "CHANNEL_ICON_CHANGE"
            break
        case 6:
            this.type = "CHANNEL_PINNED_MESSAGE"
            break
        case 7:
            this.type = "GUILD_MEMBER_JOIN"
            break
        case 8:
            this.type = "USER_PREMIUM_GUILD_SUBSCRIPTION"
            break
        case 9:
            this.type = "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1"
            break
        case 10:
            this.type = "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2"
            break
        case 11:
            this.type = "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3"
            break
        case 12:
            this.type = "CHANNEL_FOLLOW_ADD"
            break
        case 14:
            this.type = "GUILD_DISCOVERY_DISQUALIFIED"
            break
        case 15:
            this.type = "GUILD_DISCOVERY_REQUALIFIED"
            break
        case 19: 
            this.type = "REPLY"
            break
        case 20:
            this.type = "APPLICATION_COMMAND"
            break
        }
    }
    async react(emoji: Emoji|string) {
        await this._bot.http.addReaction(this.channel.id, this.id, emoji)
    }
    async removeReaction(emoji: Emoji|string, userID?: string) {
        if (userID) {
            await this._bot.http.removeUserReaction(this.channel.id, this.id, emoji, userID)
            return
        }
        await this._bot.http.removeUserReaction(this.channel.id, this.id, emoji)
    }
    async removeAllReactions(emoji?: Emoji|string) {
        if (emoji) {
            await this._bot.http.deleteReactions(this.channel.id, this.id, emoji)
            return
        }
        await this._bot.http.deleteReactions(this.channel.id, this.id)
    }
    async edit(opts: {
        content?: string,
        flags?: number,
        embed?: Embed,
        allowed_mentions?: any,
        nonce?: string | number 
    } | string) {
        if (this.author.id !== this._bot.user.id) throw new TypeError("Cannot edit message as it was not sent by client.")
        let data
        if (typeof opts === "string") data = { content: opts }
        else {
            data = { ...opts }
        } 
        return this._bot.http.editMessage(this.channel.id, this.id, data)
    }
    async reply(opts: MessageOptions) {
        let data
        if (typeof opts === "string") data = { content: opts }
        else {
            data = { ...opts }
        }
        return this._bot.http.sendMessage(this.channel.id, {
            ...data,
            message_reference: {
                message_id: this.id,
                ...(this.guild ? { guild_id: this.guild.id } : {})
            }
        }, this._bot)
    }
    async findReactions(emoji: Emoji|string, options?: { before?: string, after?: string, limit?: number }) {
        return this._bot.http.getReactions(this.channel.id, this.id, emoji, options ?? {})
    }
    async pin() {
        await this._bot.http.addPinnedMessage(this.channel.id, this.id)
    }
    async unpin() {
        await this._bot.http.deletePinnedMessage(this.channel.id, this.id)
    }
    async announce() {
        if (this.channel instanceof c.NewsChannel) return this.channel.crosspost(this.id)
        throw new TypeError("Not a news channel.")
    }
    async delete() {
        return this._bot.http.deleteMessage(this.channel.id, this.id)
    }
}