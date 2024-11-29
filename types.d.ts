type CourseProps = {
    course: CourseAsList
}

type Editing = {
    cards: Card[]
    texts: string[]
}

type Course = {
    id: string
    cards: Card[]
    unreviewed: Card[]
    textUnreviewed: string[]
    mark?: boolean
}

type CourseAsList = {
    id: string
    cards: Card[]
    count: number
}

type Card = {
    question: string
    alternatives: string[]
    source: string
    correct: number[]
    help?: string
    theme?: string
    rating: number
    votes: Vote[]
}

type CardAsText = {
    input: string
}

type User = {
    name: string
    username: string
    time: number
    score: number
    solved: UserSolved[]
}

type LoggedInUser = {
    name: string
    username: string
    time: number
}

type UserPage = {
    id: number
    username: string
    password: string
    position: number
    name: string
    score: number
    time: number
    solved: UserSolved[]
}

type UserSolved = {
    id: string
    cards: number[]
}

type RegisterUser = {
    username: string
    password: string
    firstName: string
    lastName: string
}

type LoginUser = {
    username: string
    password: string
}

type LoginResponse = {
    name: string
    username: string
    token: string
    time: number
    score: number
    solved: UserSolved[]
}

type ScoreBoardUser = {
    id: number
    score: number
    solved: number
    username: string
    time: number
}

type CardComment = {
    id: number
    courseID: string
    cardID: number
    username: string
    content: string
    time: string
    rating: number
    replies?: CardComment[]
    votes: Vote[]
}

type Vote = {
    username: string
    vote: boolean
}

type Files = {
    name: string
    content: string
    files: Files[]
    parent?: string
}

type FileListProps = {
    files: Files[]
    path: string
    inputRef: MutableRefObject<HTMLInputElement | null>
}

type ClientVote = {
    commentID: number
    vote: boolean
    isReply?: true
}
