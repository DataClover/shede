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
          '在「决策」页点击“拍照开始决策”，也可以从相册选择图片。',
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
          '六维分数统一为越高越该留；占用空间分越高代表越省空间。',
          '是否重复当前用“有替代”答案近似，AI 只给建议，最终决定由你做。'
        ]
      },
      {
        id: 'observe',
        title: '30 天观察箱',
        icon: 'cuIcon-time',
        expanded: false,
        lines: [
          '拿不定主意时选择观察，系统记录 30 天到期日。',
          '实际用到就点“我用到了”；用到 3 次会提示可以直接留下。',
          '到期后可留下、处理，或重新查看结论。'
        ]
      },
      {
        id: 'dispose',
        title: '出售与处理建议',
        icon: 'cuIcon-delete',
        expanded: false,
        lines: [
          '出售、转赠、回收和丢弃都有对应的下一步建议。',
          '出售建议包含估价区间和平台，可以复制文案，完成后标记已处理。'
        ]
      },
      {
        id: 'common-issues',
        title: '常见问题',
        icon: 'cuIcon-question',
        expanded: false,
        lines: [
          '识别不准确：在确认页直接修改名称、分类和描述。',
          '没有 AI key：演示模式会使用后端规则降级，完整流程仍可走通。',
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
