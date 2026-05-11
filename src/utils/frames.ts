export type FrameTemplate = {
  id: string;
  name: string;
  src: string;
};

export const frameTemplates: FrameTemplate[] = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  const fileName = `头像框${number}.png`;

  return {
    id: `frame-${number}`,
    name: `头像框 ${number}`,
    src: `/frames/${encodeURIComponent(fileName)}`
  };
});
