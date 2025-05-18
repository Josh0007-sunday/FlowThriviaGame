import { useEffect, useState } from "react";
import * as fcl from "@onflow/fcl";
import { WalletButton } from "../component/common/walletButton";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Question, PlayerStats } from "../types";
import triviaImage from "../assets/trivia.jpg";
import bgImage from "../assets/bg.svg";
import Confetti from 'react-confetti';

export function GamePage() {
  const { user } = useCurrentUser();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    message: string;
    isCorrect: boolean;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Handle window resize for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch all questions and answered questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log("Fetching questions from contract...");
        const result = await fcl.query({
          cadence: `
            import TriviaGame from 0xTriviaGame
            access(all) fun main(): [TriviaGame.Question] {
              let questions: [TriviaGame.Question] = []
              var id: UInt64 = 1
              
              // Try to get questions until we hit a gap
              while true {
                if let question = TriviaGame.getQuestion(id: id) {
                  questions.append(question)
                  id = id + 1
                } else {
                  break
                }
              }
              
              log("Number of questions fetched: ".concat(questions.length.toString()))
              return questions
            }
          `,
          args: () => [],
        });
        
        console.log("Raw result from contract:", result);
        
        if (Array.isArray(result)) {
          console.log("Number of questions received:", result.length);
          console.log("First question:", result[0]);
          setQuestions(result);
        } else {
          console.error("Expected array of questions but got:", result);
          setQuestions([]);
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  // Fetch player stats and answered questions when user changes
  useEffect(() => {
    if (!user?.addr) return;

    const fetchPlayerData = async () => {
      try {
        // Fetch player stats
        const stats = await fcl.query({
          cadence: `
            import TriviaGame from 0xTriviaGame
            access(all) fun main(address: Address): TriviaGame.PlayerStats? {
              return TriviaGame.getPlayerStats(address: address)
            }
          `,
          args: (arg: any, t: any) => [arg(user.addr, t.Address)],
        });
        setPlayerStats(stats);

        // Fetch answered questions
        const answered = await fcl.query({
          cadence: `
            import TriviaGame from 0xTriviaGame
            access(all) fun main(address: Address): [UInt64] {
              return TriviaGame.getAnsweredQuestions(address: address)
            }
          `,
          args: (arg: any, t: any) => [arg(user.addr, t.Address)],
        });
        
        if (Array.isArray(answered)) {
          setAnsweredQuestions(new Set(answered.map(id => id.toString())));
        }
      } catch (error) {
        console.error("Failed to fetch player data:", error);
      }
    };

    fetchPlayerData();
  }, [user?.addr]);

  const handleQuestionSelect = (question: Question) => {
    // Check if question has been answered
    if (answeredQuestions.has(question.id.toString())) {
      setFeedback({
        message: "You've already answered this question!",
        isCorrect: false,
      });
      return;
    }
    setSelectedQuestion(question);
    setSelectedOption(null);
    setFeedback(null);
  };

  const handleOptionSelect = (index: number) => {
    if (feedback !== null) return; // Don't allow selection after answer is submitted
    setSelectedOption(index);
  };

  const handleAnswerSubmit = async () => {
    if (selectedOption === null || !user?.addr || !selectedQuestion) return;

    // Double check if question has been answered
    if (answeredQuestions.has(selectedQuestion.id.toString())) {
      setFeedback({
        message: "You've already answered this question!",
        isCorrect: false,
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      console.log("Submitting answer:", {
        questionId: selectedQuestion.id,
        selectedOption,
        correctOption: selectedQuestion.correctOptionIndex
      });

      const txId = await fcl.mutate({
        cadence: `
          import TriviaGame from 0xTriviaGame
          transaction(questionId: UInt64, selectedOptionIndex: UInt) {
            prepare(signer: &Account) {
              let isCorrect = TriviaGame.answerQuestion(
                questionId: questionId,
                selectedOptionIndex: selectedOptionIndex,
                signer: signer
              )
              log(isCorrect ? "Correct!" : "Wrong answer")
            }
          }
        `,
        args: (arg: any, t: any) => [
          arg(selectedQuestion.id, t.UInt64),
          arg(selectedOption, t.UInt),
        ],
        limit: 999,
      });

      console.log("Transaction submitted:", txId);

      // Wait for transaction to be sealed
      const transaction = await fcl.tx(txId).onceSealed();
      console.log("Transaction sealed:", transaction);
      
      // Check if the answer was correct
      const isCorrect = Number(selectedOption) === Number(selectedQuestion.correctOptionIndex);
      
      setFeedback({
        message: isCorrect ? "Correct! 🎉" : "Wrong answer 😢",
        isCorrect,
      });

      // Show confetti if correct
      if (isCorrect) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000); // Hide confetti after 5 seconds
      }

      // Add question to answered set
      setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id.toString()]));

      // Refresh player stats
      const updatedStats = await fcl.query({
        cadence: `
          import TriviaGame from 0xTriviaGame
          access(all) fun main(address: Address): TriviaGame.PlayerStats? {
            return TriviaGame.getPlayerStats(address: address)
          }
        `,
        args: (arg: any, t: any) => [arg(user.addr, t.Address)],
      });

      console.log("Updated player stats:", updatedStats);
      setPlayerStats(updatedStats);

      // Close the question after a short delay
      setTimeout(() => {
        setSelectedQuestion(null);
        setSelectedOption(null);
        setFeedback(null);
      }, 2000);

    } catch (error) {
      console.error("Failed to submit answer:", error);
      setFeedback({
        message: "Error submitting answer. Please try again.",
        isCorrect: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      {/* Background with overlay */}
      <div className="fixed inset-0 z-0">
        <img src={bgImage} alt="background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="container mx-auto px-4 relative z-10 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            <span className="titan-one-regular-400 text-[#3fad6e]">Trivia</span> Quest
          </h1>
          <WalletButton />
        </div>

        {!user?.loggedIn ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-xl p-8">
            <p className="text-xl text-white">
              Connect your wallet to start your trivia adventure! 🎮
            </p>
            <img 
              src="/src/assets/connect.jpg" 
              alt="Connect Wallet" 
              className="mt-6 mx-auto max-w-md rounded-lg shadow-lg"
            />
          </div>
        ) : isLoading ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-xl p-8">
            <p className="text-xl text-white">Loading your quest... ⚔️</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-xl p-8">
            <p className="text-xl text-white">No questions available yet. Time to create some challenges! 🎯</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Player Stats */}
            {playerStats && (
              <div className="mb-6 p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">Adventurer's Stats</h3>
                  <div className="text-sm text-gray-300">
                    {playerStats.address.slice(0, 6)}...{playerStats.address.slice(-4)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/30">
                    <p className="text-sm text-yellow-300 font-medium">Victories</p>
                    <p className="text-2xl font-bold text-yellow-400">{playerStats.correctAnswers}</p>
                  </div>
                  <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-purple-300 font-medium">Challenges Completed</p>
                    <p className="text-2xl font-bold text-purple-400">{playerStats.totalAnswers}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  onClick={() => handleQuestionSelect(question)}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20 ${
                    answeredQuestions.has(question.id.toString()) ? 'opacity-50' : ''
                  }`}
                >
                  <div className="relative h-40">
                    <img 
                      src={triviaImage} 
                      alt="Trivia" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex justify-between items-start">
                        <span className="inline-block px-3 py-1 bg-yellow-500/30 text-yellow-300 rounded-full text-sm border border-yellow-500/50">
                          {question.category}
                        </span>
                        <span className="inline-block px-3 py-1 bg-purple-500/30 text-purple-300 rounded-full text-sm border border-purple-500/50">
                          Level {question.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white line-clamp-2 mb-2">{question.text}</h3>
                    {answeredQuestions.has(question.id.toString()) && (
                      <div className="text-sm text-gray-400">
                        Challenge Completed ✓
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Question Modal */}
            {selectedQuestion && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-white/20">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 bg-yellow-500/30 text-yellow-300 rounded-full text-sm font-medium border border-yellow-500/50">
                        {selectedQuestion.category}
                      </span>
                      <span className="inline-block ml-2 px-3 py-1 bg-purple-500/30 text-purple-300 rounded-full text-sm font-medium border border-purple-500/50">
                        Level {selectedQuestion.difficulty}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className="text-white hover:text-yellow-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  <h2 className="text-xl font-semibold mb-6 text-white">{selectedQuestion.text}</h2>

                  <div className="space-y-3">
                    {selectedQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleOptionSelect(index)}
                        disabled={feedback !== null}
                        className={`w-full text-left p-4 rounded-lg transition-all duration-300 ${
                          selectedOption === index
                            ? "bg-yellow-500/30 border-yellow-500/50 text-yellow-300"
                            : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                        } ${
                          feedback !== null && 
                          index === Number(selectedQuestion.correctOptionIndex)
                            ? "bg-green-500/30 border-green-500/50 text-green-300"
                            : feedback !== null && 
                              selectedOption === index && 
                              index !== Number(selectedQuestion.correctOptionIndex)
                            ? "bg-red-500/30 border-red-500/50 text-red-300"
                            : ""
                        } border`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {feedback && (
                    <div
                      className={`mt-4 p-4 rounded-lg ${
                        feedback.isCorrect
                          ? "bg-green-500/30 text-green-300 border border-green-500/50"
                          : "bg-red-500/30 text-red-300 border border-red-500/50"
                      }`}
                    >
                      {feedback.message}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleAnswerSubmit}
                      disabled={selectedOption === null || isLoading || feedback !== null}
                      className={`px-6 py-2 rounded-lg text-white font-medium transition-all duration-300 ${
                        selectedOption === null || isLoading || feedback !== null
                          ? "bg-gray-500/50 cursor-not-allowed"
                          : "bg-yellow-500 hover:bg-yellow-600 transform hover:scale-105"
                      }`}
                    >
                      {isLoading ? "Submitting..." : "Submit Answer"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}