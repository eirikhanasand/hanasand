'use client'
import { useState, useRef } from "react"
import Link from "next/link"
import { sendMark } from "@/utils/fetchClient"
import { useRouter } from "next/navigation"

type CardsProps = {
    id?: string
    current?: number
    course: Course | string
    comments: CardComment[][]
}

export default function Cards({id, current, course, comments}: CardsProps) {
    
    const router = useRouter()
    const [selected, setSelected] = useState<number[]>([-1])
    const selectedRef = useRef(selected)
    const cards = typeof course === 'object' ? course.cards as Card[] : []
    const card = cards[current || 0]
    selectedRef.current = selected

    function markCourse() {
        sendMark({courseID: id || "PROG1001", mark: true})
    }

    if (current && current >= cards.length ) {
        router.push(`/course/${id}/1`)
        return
    }

    if (typeof course === 'string') {
        return (
            <div className="w-full h-full grid place-items-center col-span-6">
                <h1 className="text-xl">{course}</h1>
            </div>
        )
    }

    if (!cards.length) {
        return (
            <div className="w-full h-full col-span-6 grid place-items-center">
                <div className="grid place-items-center">
                    <h1 className="text-xl text-center mb-2">Course {course.id} has no content yet.</h1>
                    <Link
                        className="bg-dark rounded-xl px-2 h-[4vh] w-[10vw] grid place-items-center mb-2 bg-orange-500"
                        href={`/edit/${course.id}`}
                    >
                        Edit course
                    </Link>
                    <h1 className="text-xl text-center mb-2">Mark course as learning based (no multiple choice)</h1>
                    <button 
                        className="bg-orange-500 rounded-xl px-2 h-[4vh] w-[10vw]"
                        onClick={markCourse}
                    >
                        Mark
                    </button>
                </div>
            </div>
        )
    }

    if (current === -1) {
        const length = cards.length

        return (
            <div className="w-full h-full grid place-items-center col-span-6">
                <h1 className="text-xl">Course {course.id} completed ({length} {length > 1 ? 'cards' : 'card'}).</h1>
            </div>
        )
    }

    if (!card) {
        router.push(`/course/${id}/1`)
    }

    return (
        <div className="w-full h-full max-h-full grid grid-rows-10 gap-8 col-span-6 overflow-hidden">

        </div>
    )
}
