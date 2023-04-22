function objectToMarkdown(obj, indent = 0) {
    let markdown = '';
    for (const key in obj) {
        const value = obj[key];
        const indentedKey = '  '.repeat(indent) + `- **${key}**:`;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            markdown += `\n${indentedKey}\n${objectToMarkdown(value, indent + 1)}`;
        } else if (Array.isArray(value)) {
            markdown += `\n${indentedKey}`;
            value.forEach((item, index) => {
                markdown += `\n  ${'  '.repeat(indent)}- ${item}`;
            });
        } else {
            markdown += `\n${indentedKey} ${value}`;
        }
    }
    return markdown;
}

function markdownToObject(markdown) {
    const lines = markdown.split('\n').filter(line => line.trim() !== '');
    const stack = [];
    let obj = {};
    let currentObj = obj;
    lines.forEach(line => {
        const level = line.search(/\S/);
        const trimmedLine = line.trim();
        const keyMatch = trimmedLine.match(/- \*\*(.+?)\*\*:/);
        const valueMatch = trimmedLine.match(/- \*\*(.+?)\*\*: (.+)/);
        const arrayItemMatch = trimmedLine.match(/- (.+)/);
        if (keyMatch) {
            const key = keyMatch[1];
            currentObj[key] = {};
            stack[level] = currentObj;
            currentObj = currentObj[key];
        } else if (valueMatch) {
            const key = valueMatch[1];
            const value = valueMatch[2];
            currentObj[key] = value;
        } else if (arrayItemMatch) {
            const value = arrayItemMatch[1];
            if (!Array.isArray(currentObj)) {
                currentObj = [];
                stack[level - 2][keyMatch[1]] = currentObj;
            }
            currentObj.push(value);
        }
    });
    return obj;
}

function objectListToMarkdownTable(objList) {
    const objList0 = objList[0];
    const objFields = Object.keys(objList0);
    const table = new Table({
        head: objFields,
        colWidths: objFields.map(() => 30),
    });
    objList.forEach(obj => {
        const objValues = objFields.map(field => obj[field]);
        table.push(objValues);
    });
    return table.toString();
}

function markdownTableToObjectList(markdownTable) {
    const table = new Table(markdownTable);
    const objList = [];
    table.forEach(obj => {
        objList.push(obj);
    });
    return objList;
}

class Table {
    constructor(markdownTable) {
        this.head = markdownTable[0];
        this.rows = markdownTable.slice(1);
    }

    forEach(callback) {
        this.rows.forEach(row => {
            const obj = {};
            this.head.forEach((field, index) => {
                obj[field] = row[index];
            });
            callback(obj);
        });
    }
}

function sourceToMarkdown(sourcePath, sourceContent) {
    const source = {
        path: sourcePath,
        content: sourceContent,
    };
    return objectToMarkdown(source);
}

function markdownToSource(markdown) {
    const source = markdownToObject(markdown);
    return source;
}

module.exports = {
    objectToMarkdown,
    markdownToObject,
};