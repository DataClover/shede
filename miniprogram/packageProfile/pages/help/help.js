Page({
  data: {
    loading: false,
    sections: [
      {
        id: 'getting-started',
        title: '快速开始',
        icon: 'cuIcon-camera',
        expanded: true,
        lines: [
          '在「首页」点「拍一件让你纠结的东西」，也可以从相册选一张。',
          '确认识别出的名称、分类和描述后，物品会独立保存并直接进入四问。'
        ]
      },
      {
        id: 'decision-questions',
        title: '四问与六维评分',
        icon: 'cuIcon-edit',
        expanded: false,
        lines: [
          '固定回答使用频率、重新购买意愿、是否可替代和情感价值四个问题。',
          '分数越高，越偏向留下；占用空间分越高代表它越不占地儿。',
          '是否重复当前用“有替代”答案近似，AI 只给建议，最终决定由你做。'
        ]
      },
      {
        id: 'observe',
        title: '30 天观察箱',
        icon: 'cuIcon-time',
        expanded: false,
        lines: [
          '拿不定主意时选择「再想想」，系统记下 30 天后的日子。',
          '这期间用到就点「这次用上了」；用到 3 次会提醒你它确实有用。',
          '到期后可以留下、送它走，或再看看分析。'
        ]
      },
      {
        id: 'dispose',
        title: '它的下一站',
        icon: 'cuIcon-delete',
        expanded: false,
        lines: [
          '卖掉、送人、回收、扔掉，各有对应的下一步。',
          '卖掉会给估价区间和平台，可以复制文案，办完标记完成。'
        ]
      },
      {
        id: 'common-issues',
        title: '常见问题',
        icon: 'cuIcon-question',
        expanded: false,
        lines: [
          '识别不准确：在确认页直接修改名称、分类和描述。',
          '没有 AI 密钥：识别与评分由本地规则兜底，完整流程照样走通。',
          '请求失败：确认后端已启动；真机预览时把 baseUrl 改为电脑局域网地址。'
        ]
      }
    ]
  },

  onToggleSection(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      sections: this.data.sections.map(section => Object.assign({}, section, {
        expanded: section.id === id ? !section.expanded : section.expanded
      }))
    });
  }
});
