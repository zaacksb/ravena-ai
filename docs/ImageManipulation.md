# Installation Guide: Image Manipulation Module

Follow these steps to add image manipulation capabilities to your WhatsApp bot.

## Step 1: Install Required Dependencies

### System Requirements

First, install ImageMagick on your system:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install imagemagick
```

**macOS:**
```bash
brew install imagemagick
```

**Windows:**
1. Download installer from [ImageMagick website](https://imagemagick.org/script/download.php)
2. Run the installer and ensure "Install legacy utilities" is selected
3. Restart your computer after installation

### Python Requirements

Install Python 3.7+ if not already installed, then:

```bash
# Install rembg for background removal
python -m pip install rembg
```

### Node.js Dependencies

Update your project dependencies:

```bash
# Install required npm packages
npm install sharp imagemagick uuid
```

## Step 2: Add the Module to Your Project

1. Copy the `ImageManipulation.js` file to your `src/functions/` directory
2. Update your package.json to include the new dependencies
3. Restart your bot

## Step 3: Verify Installation

Check that everything is working correctly:

```bash
# Verify ImageMagick installation
convert -version

# Verify rembg installation
python -c "import rembg; print('rembg installed successfully')"

# Verify sharp installation
node -e "require('sharp'); console.log('sharp installed successfully')"
```

## Troubleshooting

### Common Issues

**Error: "Unable to find python"**
- Ensure Python is in your PATH environment variable
- Try specifying full path in the removeBackground function

**Error: "Invalid Parameter - rembg"**
- Make sure you've installed rembg with `python -m pip install rembg`
- Try reinstalling with `python -m pip install --upgrade rembg`

**Error: "unable to open image"**
- Check that ImageMagick is properly installed
- Verify file paths and permissions in temp directory

**Performance Issues**
- The first background removal might be slow due to model download
- Subsequent operations should be faster
- Consider adding a timeout for long-running operations