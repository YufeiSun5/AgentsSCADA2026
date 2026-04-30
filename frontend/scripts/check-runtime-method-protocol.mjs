/*
 * 物料运行态方法与协议层一致性检查。
 * 扫描 Material 中 registerComponent 注册的方法，确保协议文件能被 AI 上下文读到。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const script_dir = path.dirname(fileURLToPath(import.meta.url));
const frontend_root = path.resolve(script_dir, '..');

const component_pairs = [
    ['button', 'ButtonMaterial.tsx', 'buttonProtocol.ts'],
    ['text', 'TextMaterial.tsx', 'textProtocol.ts'],
    ['image', 'ImageMaterial.tsx', 'imageProtocol.ts'],
    ['table', 'TableMaterial.tsx', 'tableProtocol.ts'],
    ['chart', 'ChartMaterial.tsx', 'chartProtocol.ts'],
];

function read_file(relative_path)
{
    return fs.readFileSync(path.join(frontend_root, relative_path), 'utf8');
}

function get_property_name(node)
{
    if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
        return node.name.text;
    }
    return '';
}

function collect_register_methods(source_text, file_name)
{
    const source_file = ts.createSourceFile(
        file_name,
        source_text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );
    const methods = new Set();

    function visit(node)
    {
        if (ts.isCallExpression(node)) {
            const expression_text = node.expression.getText(source_file);
            if (expression_text.includes('registerComponent')) {
                const methods_arg = node.arguments[1];
                if (methods_arg && ts.isObjectLiteralExpression(methods_arg)) {
                    methods_arg.properties.forEach((property) => {
                        if (ts.isPropertyAssignment(property)
                            || ts.isMethodDeclaration(property)
                            || ts.isShorthandPropertyAssignment(property)) {
                            const method_name = get_property_name(property);
                            if (method_name) {
                                methods.add(method_name);
                            }
                        }
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(source_file);
    return [...methods].sort();
}

const missing = [];

component_pairs.forEach(([component_type, material_file, protocol_file]) => {
    const material_path = `src/components/materials/${material_file}`;
    const protocol_path = `src/schema/protocols/components/${protocol_file}`;
    const methods = collect_register_methods(read_file(material_path), material_file);
    const protocol_text = read_file(protocol_path);

    methods.forEach((method_name) => {
        if (!protocol_text.includes(method_name)) {
            missing.push(`${component_type}.${method_name} -> ${protocol_path}`);
        }
    });
});

if (missing.length > 0) {
    console.error('协议层缺少以下运行态方法说明：');
    missing.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
}

console.log('运行态方法协议一致性检查通过。');
