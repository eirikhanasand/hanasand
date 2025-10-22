export default function randomId(length = 6) {
    const validCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let result = ''
    
    for (let i = 0; i < length; i++) {
        const index = Math.floor(Math.random() * validCharacters.length)
        result += validCharacters[index]
    }
    
    return result
}
