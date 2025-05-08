const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const util = require('util');

const readFileAsync = util.promisify(fs.readFile);
const readdirAsync = util.promisify(fs.readdir);
const statAsync = util.promisify(fs.stat);

async function loadGitignore(rootPath) {
    const ig = ignore();
    try {
        const gitignorePath = path.join(rootPath, '.gitignore');
        const gitignoreContent = await readFileAsync(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
    } catch (error) {
        // If .gitignore doesn't exist, use some default rules
        ig.add([
            'node_modules',
            '.git',
            'dist',
            'build',
            '.env',
            '*.log',
            '.DS_Store'
        ]);
    }
    return ig;
}

async function scanDirectory(dirPath, ig, basePath = '') {
    const structure = {
        type: 'directory',
        name: path.basename(dirPath),
        path: dirPath,
        children: []
    };

    try {
        const entries = await readdirAsync(dirPath);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const relativePath = path.relative(basePath, fullPath);

            // Skip if file/directory is ignored
            if (ig.ignores(relativePath)) {
                continue;
            }

            const stats = await statAsync(fullPath);

            if (stats.isDirectory()) {
                const subStructure = await scanDirectory(fullPath, ig, basePath);
                structure.children.push(subStructure);
            } else {
                try {
                    // Read first few lines of text files
                    let preview = '';
                    if (isTextFile(entry)) {
                        const content = await readFileAsync(fullPath, 'utf8');
                        preview = content.split('\n').slice(0, 5).join('\n');
                        if (content.split('\n').length > 5) {
                            preview += '\n...';
                        }
                    }

                    structure.children.push({
                        type: 'file',
                        name: entry,
                        path: fullPath,
                        size: stats.size,
                        preview: preview
                    });
                } catch (error) {
                    // If can't read file, just add basic info
                    structure.children.push({
                        type: 'file',
                        name: entry,
                        path: fullPath,
                        size: stats.size
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }

    return structure;
}

function isTextFile(filename) {
    const textExtensions = [
        '.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.yaml', '.yml',
        '.html', '.css', '.scss', '.less', '.py', '.java', '.rb', '.php',
        '.config', '.env', '.gitignore', '.xml', '.csv'
    ];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

async function generateProjectStructure(rootPath) {
    const ig = await loadGitignore(rootPath);
    const structure = await scanDirectory(rootPath, ig, rootPath);
    return structure;
}

// Save the structure to a file
async function saveStructureToFile(structure, outputPath) {
    const jsonContent = JSON.stringify(structure, null, 2);
    await fs.promises.writeFile(outputPath, jsonContent, 'utf8');
}

// Main execution
const rootPath = process.cwd(); // Current working directory
const outputPath = path.join(rootPath, 'project-structure.json');

generateProjectStructure(rootPath)
    .then(async (structure) => {
        await saveStructureToFile(structure, outputPath);
        console.log(`Project structure has been saved to ${outputPath}`);
        
        // Also print a summary to console
        console.log('\nProject Structure Summary:');
        console.log(JSON.stringify(structure, null, 2));
    })
    .catch(error => {
        console.error('Error generating project structure:', error);
    });