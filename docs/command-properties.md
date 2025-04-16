# Command Properties

Commands defined in the `functions` folder can have the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | **Required**. The name of the command, used to match user input after the prefix. |
| `description` | string | Description of what the command does, shown in help messages. |
| `method` | function | **Required**. The function to execute when the command is triggered. Receives `(bot, message, args, group)` parameters. |
| `needsMedia` | boolean | If `true`, the command requires media content to be present in either the message itself or in a quoted message. Commands without this media will be silently ignored. |
| `needsQuotedMsg` | boolean | If `true`, the command requires a quoted message to function. Commands without a quoted message will be silently ignored. |
| `aliases` | array | Alternative names for the command. |
| `cooldown` | number | Cooldown time in seconds between uses of this command. |
| `adminOnly` | boolean | If `true`, only admins can use the command. |
| `groupOnly` | boolean | If `true`, the command can only be used in groups. |
| `privateOnly` | boolean | If `true`, the command can only be used in private chats. |
| `enabled` | boolean | If `false`, the command is disabled and won't be registered. |
| `hidden` | boolean | If `true`, the command won't be shown in help listings. |

## Example:

```javascript
{
  name: 'sticker',
  description: 'Convert media to sticker',
  needsMedia: true,
  cooldown: 5,
  method: async (bot, message, args, group) => {
    // Command implementation
  }
}
```

## Advanced Usage

You can define multiple commands with the same name but different requirements to handle various scenarios:

```javascript
const commands = [
  // For handling audio distortion when direct message has audio
  {
    name: 'distort',
    description: 'Distort attached audio',
    needsMedia: true,
    method: distortDirectAudio
  },
  
  // For handling audio distortion when replied message has audio
  {
    name: 'distort',
    description: 'Distort audio in replied message',
    needsQuotedMsg: true,
    method: distortRepliedAudio
  }
];
```

The system will try to match the most specific command that meets all requirements.