# ReturnMessage Model

## Overview

The ReturnMessage model was developed to streamline the message sending workflow in the WhatsApp bot. It encapsulates all the parameters needed to send a message, enabling command functions to return structured message objects instead of handling message sending directly.

## Implementation Details

### ReturnMessage Class

The ReturnMessage class was created to represent a message that should be sent by the bot. It contains the following properties:

- **chatId**: The ID of the chat/group to send the message to
- **content**: The content of the message (string or MessageMedia object)
- **options**: Additional options for sending the message
- **reactions**: Message reaction emojis configuration
- **delay**: Optional delay before sending the message (milliseconds)
- **metadata**: Optional custom metadata for tracking or other purposes

The class also includes utility methods:

- **isValid()**: Validates if the ReturnMessage has all required properties
- **toJSON()**: Converts ReturnMessage to a simple object for serialization

### sendReturnMessages Method

The `sendReturnMessages` method was added to the WhatsAppBot class to handle sending one or more ReturnMessage objects. It:

1. Accepts either a single ReturnMessage or an array of ReturnMessages
2. Validates each message
3. Applies any configured delays between messages
4. Sends each message using the existing sendMessage method
5. Handles reactions if specified
6. Returns an array of results from the send operations

## Benefits

1. **Consistent message structure**: All message sending follows the same pattern
2. **Simplified command functions**: Functions can return ReturnMessage objects instead of handling sending directly
3. **Batch processing**: Multiple messages can be handled in a single call
4. **Added features**: Supports delays between messages and automatic reactions
5. **Separation of concerns**: Message creation is separated from message sending

## Usage Examples

### Basic Usage

```javascript
const ReturnMessage = require('../models/ReturnMessage');

// In a command function
async function myCommand(bot, message, args, group) {
  // Create a ReturnMessage
  const returnMessage = new ReturnMessage({
    chatId: message.group || message.author,
    content: "Hello, world!",
    options: {
      quotedMessageId: message.origin.id._serialized
    }
  });
  
  // Return the message object
  return returnMessage;
}

// In the command handler
const result = await myCommand(bot, message, args, group);
await bot.sendReturnMessages(result);
```

### Multiple Messages

```javascript
// In a command function
async function multiMessageCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  return [
    new ReturnMessage({
      chatId,
      content: "First message",
      delay: 0
    }),
    new ReturnMessage({
      chatId,
      content: "Second message (delayed)",
      delay: 2000 // 2 second delay
    }),
    new ReturnMessage({
      chatId,
      content: "Third message (with reaction)",
      reactions: {
        before: "⏳",
        after: "✅"
      }
    })
  ];
}
```

### Media Message

```javascript
// In a command function
async function mediaCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const media = await bot.createMedia('path/to/image.jpg');
  
  return new ReturnMessage({
    chatId,
    content: media,
    options: {
      caption: "Check out this image!"
    }
  });
}
```

## Integration with Command Handlers

The command system can be adjusted to automatically process ReturnMessage results:

```javascript
async function executeFixedCommand(bot, message, command, args, group) {
  try {
    // Execute command method which now returns ReturnMessage(s)
    const result = await command.method(bot, message, args, group);
    
    // Check if the result is a ReturnMessage or array of ReturnMessages
    if (result) {
      if (result instanceof ReturnMessage || 
          (Array.isArray(result) && result[0] instanceof ReturnMessage)) {
        // Send the return messages
        await bot.sendReturnMessages(result);
        return;
      }
    }
    
    // Traditional behavior for backwards compatibility
    // (existing code that doesn't return ReturnMessage objects)
  } catch (error) {
    // Error handling...
  }
}
```

## Future Improvements

Potential future enhancements to the ReturnMessage system:

1. Add support for scheduled messages
2. Implement message queuing for rate limiting
3. Add delivery status tracking
4. Extend with templates for common message formats
5. Support for conditional sending based on user/group properties