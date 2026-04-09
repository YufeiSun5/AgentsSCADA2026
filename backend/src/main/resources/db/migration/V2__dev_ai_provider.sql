-- 开发/测试阶段：插入一条 AI 服务商配置（MiniMax Anthropic 兼容端点）
-- api_key 此处以明文存储（仅限 dev 环境），生产环境通过加密 API 写入
-- 服务调用路径：{base_url}/v1/messages（Anthropic Messages API 格式）
-- 如需更换 key 或模型，直接 UPDATE sys_ai_providers WHERE provider_key='dev-test'
INSERT INTO sys_ai_providers (name, provider_key, base_url, api_key, model, max_tokens_per_req, enabled, sort_order)
VALUES (
    'MiniMax 测试',
    'dev-test',
    'https://api.minimaxi.com/anthropic',
    'sk-placeholder',
    'MiniMax-M2.7',
    2000,
    true,
    0
)
ON CONFLICT (provider_key) DO NOTHING;
