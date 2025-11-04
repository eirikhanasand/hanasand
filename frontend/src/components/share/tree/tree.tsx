import FileNode from './fileNode'

export default function Tree({ tree }: { tree: Tree }) {
    return (
        <ul className='group space-y-1'>
            {tree.map((file) => (
                <FileNode key={file.id} file={file} />
            ))}
        </ul>
    )
}
