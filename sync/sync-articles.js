// ============================================
// 微信公众号文章同步脚本
// ============================================
// 定期从微信API抓取已发布文章并存入 Supabase
// 在 GitHub Actions 中运行，凭证通过环境变量传入
// ============================================

const WX_APPID = process.env.WX_APPID;
const WX_APPSECRET = process.env.WX_APPSECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!WX_APPID || !WX_APPSECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('缺少必要环境变量，请检查 GitHub Secrets 配置');
  process.exit(1);
}

// 分类关键词映射
const CATEGORY_KEYWORDS = {
  'new-species': ['职业新物种', '新职业', '新兴职业', 'AI职业', '数字职业', '未来职业', '新物种'],
  'insight': ['职场', '洞察', '行业', '趋势', '前景', '分析', '报告', '招聘', '就业'],
  'confusion': ['困惑', '迷茫', '选择', '方向', '解惑', '答疑', '怎么办', '规划', '迷茫'],
  'book': ['书', '推荐', '阅读', '读书', '好书', '书评'],
  'activity': ['活动', '讲座', '工作坊', '沙龙', '培训', '动态', '通知', '预告', '回顾'],
  'team': ['团队', '介绍', '成员', '老师', '导师', '咨询师', '工作室']
};

const CATEGORY_NAMES = {
  'new-species': '职业新物种',
  'insight': '职场洞察',
  'confusion': '生涯解惑',
  'book': '好书推荐',
  'activity': '工作室动态',
  'team': '团队介绍'
};

// 获取微信 access_token
async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_APPSECRET}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.access_token) {
    console.log('✅ 获取 access_token 成功');
    return data.access_token;
  }
  throw new Error(`获取access_token失败: ${data.errmsg || JSON.stringify(data)}`);
}

// 获取已发布文章列表（freepublish API）
async function getPublishedArticles(token, offset, count) {
  const url = 'https://api.weixin.qq.com/cgi-bin/freepublish/batchget';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset: offset,
      count: count,
      no_content: 0  // 0=返回内容, 1=不返回内容
    })
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`freepublish API 错误: errcode=${data.errcode}, errmsg=${data.errmsg}`);
  }
  return data;
}

// 获取永久素材列表（备用，freepublish 失败时用）
async function getMaterialList(token, offset, count) {
  const url = 'https://api.weixin.qq.com/cgi-bin/material/batchget_material';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'news', offset: offset, count: count })
  });
  const data = await res.json();
  if (data.item) return data;
  throw new Error(`batchget_material 错误: ${data.errmsg || JSON.stringify(data)}`);
}

// 根据标题和摘要自动分类
function categorizeArticle(title, digest) {
  const text = (title + ' ' + digest).toLowerCase();
  let bestCat = 'insight';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}

// 格式化日期
function formatDate(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// 从HTML中提取纯文本（用于搜索）
function extractPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 1000);
}

// Upsert 文章到 Supabase
async function upsertArticle(article) {
  const url = `${SUPABASE_URL}/rest/v1/articles`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(article)
  });

  if (res.ok) {
    console.log(`  ✅ 已同步: ${article.title}`);
    return true;
  } else {
    // 如果是唯一约束冲突（文章已存在），尝试更新
    if (res.status === 409) {
      const updateRes = await fetch(`${url}?wx_media_id=eq.${article.wx_media_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(article)
      });
      if (updateRes.ok) {
        console.log(`  🔄 已更新: ${article.title}`);
        return true;
      }
      const errText = await updateRes.text();
      console.error(`  ❌ 更新失败: ${article.title}`, errText);
      return false;
    }
    const errText = await res.text();
    console.error(`  ❌ 插入失败: ${article.title}`, errText);
    return false;
  }
}

// 主流程
async function main() {
  console.log('🚀 开始同步公众号文章...');
  console.log(`   AppID: ${WX_APPID}`);

  const token = await getAccessToken();

  let offset = 0;
  const allArticles = [];
  let useFreepublish = true;

  // 尝试使用 freepublish API
  try {
    console.log('📡 使用 freepublish API 获取已发布文章...');
    while (true) {
      const data = await getPublishedArticles(token, offset, 20);
      if (!data.item || data.item.length === 0) break;

      for (const item of data.item) {
        const newsItems = item.content.news_item;
        const createTime = item.content.create_time || Math.floor(Date.now() / 1000);

        for (const news of newsItems) {
          const category = categorizeArticle(news.title, news.digest);
          allArticles.push({
            title: news.title,
            excerpt: news.digest || extractPlainText(news.content).substring(0, 100),
            content: news.content || '',
            category: category,
            category_name: CATEGORY_NAMES[category],
            date: formatDate(createTime),
            views: '阅读 0',
            likes: 0,
            cover: news.thumb_url || '',
            author: news.author || '自在生涯工作室',
            search_text: extractPlainText(news.content),
            wx_url: news.url || '',
            wx_media_id: 'pub_' + item.article_id,
            source: 'wechat'
          });
        }
      }

      offset += data.item_count;
      if (data.total_count && offset >= data.total_count) break;
      // 防止无限循环
      if (data.item_count < 20) break;
    }
  } catch (e) {
    console.log('⚠️ freepublish API 失败，切换到素材管理 API:', e.message);
    useFreepublish = false;
    offset = 0;
  }

  // freepublish 失败时，使用素材管理 API
  if (!useFreepublish) {
    console.log('📡 使用 batchget_material API 获取素材...');
    while (true) {
      const data = await getMaterialList(token, offset, 20);
      if (!data.item || data.item.length === 0) break;

      for (const item of data.item) {
        const newsItems = item.content.news_item;
        const createTime = item.content.create_time || Math.floor(Date.now() / 1000);

        for (const news of newsItems) {
          const category = categorizeArticle(news.title, news.digest);
          allArticles.push({
            title: news.title,
            excerpt: news.digest || extractPlainText(news.content).substring(0, 100),
            content: news.content || '',
            category: category,
            category_name: CATEGORY_NAMES[category],
            date: formatDate(createTime),
            views: '阅读 0',
            likes: 0,
            cover: news.thumb_url || '',
            author: news.author || '自在生涯工作室',
            search_text: extractPlainText(news.content),
            wx_url: news.url || '',
            wx_media_id: 'mat_' + item.media_id,
            source: 'wechat'
          });
        }
      }

      offset += data.item_count;
      if (data.total_count && offset >= data.total_count) break;
      if (data.item_count < 20) break;
    }
  }

  console.log(`📊 共获取 ${allArticles.length} 篇文章，开始写入 Supabase...`);

  let successCount = 0;
  for (const article of allArticles) {
    const ok = await upsertArticle(article);
    if (ok) successCount++;
  }

  console.log(`\n🎉 同步完成！成功 ${successCount}/${allArticles.length} 篇`);
}

main().catch(err => {
  console.error('💥 同步失败:', err.message);
  process.exit(1);
});
