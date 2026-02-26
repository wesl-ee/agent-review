type Props = {
  status: 'open' | 'resolved';
};

export default function CommentBadge({ status }: Props) {
  return <span className={`badge ${status}`}>{status}</span>;
}

