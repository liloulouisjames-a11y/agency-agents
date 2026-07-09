# Business Automation Workflows

Automated daily operations for multiple business verticals using AI skills and Claude Code.

## Available Workflows

### 1. GreenEcoSolar
**Industry**: Renewable Energy & Solar Solutions

- **Daily Trigger**: Runs at 9 AM UTC via "Daily AI Marketing Operations" routine
- **Focus Areas**:
  - Solar market trend monitoring
  - Lead generation and pipeline management
  - Social media content generation (sustainability focus)
  - Email outreach optimization
  - Performance analytics

**Key Skills**:
- `cold-outbound-optimizer` - Email sequences
- `social-post` - Daily social content
- `market-research` - Competitive analysis
- `metrics-analysis` - KPI dashboards
- `autoresearch` - Campaign optimization

---

### 2. Shanghai Beauty
**Industry**: Premium Beauty & Cosmetics

- **Daily Trigger**: Runs at 9 AM UTC via "Daily AI Marketing Operations" routine
- **Focus Areas**:
  - Shanghai beauty market trend analysis
  - Multi-platform content (Xiaohongshu, WeChat, Douyin)
  - Influencer outreach coordination
  - Inventory management
  - Sales metrics and customer analytics

**Key Skills**:
- `content-creation` - Blog posts and guides
- `ad-copy` - Platform-specific ads
- `social-post` - Multi-platform content
- `customer-research` - Market insights
- `content-repurposer` - Cross-platform adaptation

---

## Daily Operations Schedule

| Time | Activity | Skills Used |
|------|----------|------------|
| 8 AM | Market monitoring & briefing | market-research, customer-research |
| 11 AM | Marketing push (content + outreach) | social-post, cold-outbound-optimizer, ad-copy |
| 3 PM | Performance optimization | metrics-analysis, autoresearch |
| 5 PM | End-of-day summary & planning | metrics-analysis |

## Installed Skill Packages

### ai-marketing-skills (9 skills)
- `autoresearch` - A/B testing and variant optimization
- `cold-outbound-optimizer` - Email campaign design
- `deck-generator` - Automated presentations
- `expert-panel` - Expert review automation
- `finance-ops` - Financial analysis
- `podcast-pipeline` - Content repurposing
- `x-longform-post` - Long-form content
- `yt-competitive-analysis` - Video benchmarking

### awesome-openclaw-agent-packs (127 skills)
Complete suite including:
- Content: blog-writer, content-repurposer, seo-content
- Sales: cold-outbound-optimizer, call-prep, pipeline
- Operations: project-breakdown, sprint-planning, capacity-plan
- Analysis: market-research, competitive-intelligence, metrics-analysis

### agentfactory-business-plugins (97 skills)
Specialized business tools:
- Business: canvas, gtm, hypothesis, pitch, sprint, validate
- Islamic Finance: murabaha, musharaka, ijarah, sukuk
- Risk & Compliance: aml-typologies, sanctions-screening, audit

---

## Scheduled Routines

### Daily AI Marketing Operations
- **Schedule**: 9:00 AM UTC (daily)
- **Trigger ID**: `trig_017v9oMfK6LkBhEghrGaEfoT`
- **Actions**:
  1. Market research & competitive analysis
  2. Content calendar planning
  3. Social media strategy
  4. Email outreach optimization
  5. Analytics review

---

## Quick Start

### Run Immediate Operations
For greenecosolar:
```bash
# Use market-research skill
/market-research greenecosolar competitive landscape

# Generate social content
/social-post greenecosolar sustainability focus
```

For shanghai-beauty:
```bash
# Multi-platform content
/content-repurposer beauty product posts for Xiaohongshu WeChat Douyin

# Ad optimization
/ad-copy Douyin beauty product promotion
```

### Create Custom Workflows
Edit the workflow markdown files to adjust:
- Timing and frequency
- Skills and tools used
- Success metrics
- Regional customizations

---

## Success Metrics Dashboard

Both businesses track:
- **Acquisition**: Lead generation rate, cost per acquisition
- **Engagement**: Social reach, email open rates, click rates
- **Conversion**: Sales revenue, conversion rate
- **Retention**: Repeat purchase rate, customer lifetime value
- **Operations**: Inventory turnover, campaign efficiency

---

## Support & Monitoring

- Check daily operation status: `Daily AI Marketing Operations` routine
- View performance data: `metrics-analysis` skill outputs
- Troubleshoot: Review logs in Claude Code session
- Customize: Edit workflow markdown files in `business-workflows/`
