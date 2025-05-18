import { useState } from "react";
import * as fcl from "@onflow/fcl";
import { type QuestionFormData } from "../../types";
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';
import bgImage from "../../assets/bg.svg";

// Initialize P-256 elliptic curve context
const ec = new EC('p256');

// Admin configuration
const ADMIN_PRIVATE_KEY = "54011f6778ae2ccc9d0175212b225b116c37c1a94262fdcdc0369cf7ae69f723";
const ADMIN_ADDRESS = "0x6749ea8e0a268f1a";
const ADMIN_KEY_INDEX = 0;

// Configure Flow client
fcl.config({
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "0xTriviaGame": ADMIN_ADDRESS,
  "0xTriviaAdmin": ADMIN_ADDRESS
});

export function CreateGameForm() {
  const [formData, setFormData] = useState<QuestionFormData>({
    text: "",
    options: ["", ""],
    correctOptionIndex: 0,
    category: "General",
    difficulty: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Proper Flow message hashing function
  const hashMessage = (message: string): Buffer => {
    const sha = new SHA3(256);
    sha.update(Buffer.from(message, 'hex'));
    return sha.digest();
  };

  // Proper P-256 signing function for Flow
  const signWithPrivateKey = (privateKeyHex: string, message: string): string => {
    try {
      // Remove '0x' prefix if present
      const cleanPrivateKey = privateKeyHex.startsWith('0x') 
        ? privateKeyHex.substring(2) 
        : privateKeyHex;
      
      // Create key from private key
      const key = ec.keyFromPrivate(cleanPrivateKey, 'hex');
      
      // Create hash of the message
      const msgHash = hashMessage(message);
      
      // Sign the hash
      const signature = key.sign(msgHash);
      
      // Get r, s values and ensure they are 32 bytes each
      const r = signature.r.toArrayLike(Buffer, 'be', 32);
      const s = signature.s.toArrayLike(Buffer, 'be', 32);
      
      // Concatenate r and s to create signature
      return Buffer.concat([r, s]).toString('hex');
    } catch (err) {
      console.error("Signing error:", err);
      throw new Error(`Failed to sign transaction: ${err}`);
    }
  };

  // FCL compatible authorization function
  const authorizationFunction = (account = {}) => {
    return {
      ...account,
      tempId: `${ADMIN_ADDRESS}-${ADMIN_KEY_INDEX}`,
      addr: fcl.sansPrefix(ADMIN_ADDRESS),
      keyId: Number(ADMIN_KEY_INDEX),
      signingFunction: async (signable: {
        message: string;
        addr?: string;
        keyId?: number;
        roles?: { proposer?: boolean; authorizer?: boolean; payer?: boolean };
        voucher?: any;
      }) => {
        try {
          // Get the message to sign
          const message = signable.message;
          
          // Sign the message
          const signature = signWithPrivateKey(ADMIN_PRIVATE_KEY, message);
          
          return {
            addr: fcl.withPrefix(ADMIN_ADDRESS),
            keyId: Number(ADMIN_KEY_INDEX),
            signature
          };
        } catch (err) {
          console.error("Signing failed:", err);
          throw err;
        }
      }
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, ""]
    }));
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      options: newOptions,
      correctOptionIndex: prev.correctOptionIndex >= newOptions.length 
        ? newOptions.length - 1 
        : prev.correctOptionIndex
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate form
      if (!formData.text.trim()) throw new Error("Question text is required");
      if (formData.options.some(opt => !opt.trim())) 
        throw new Error("All options must be filled");
      if (formData.options.length < 2) 
        throw new Error("At least 2 options are required");
      
      // Ensure correctOptionIndex is a number
      const correctOptionIndex = Number(formData.correctOptionIndex);
      if (isNaN(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= formData.options.length) {
        throw new Error("Invalid correct option index");
      }

      console.log("Submitting question with data:", {
        text: formData.text,
        options: formData.options,
        correctOptionIndex,
        category: formData.category,
        difficulty: formData.difficulty
      });

      // Build the transaction
      const txId = await fcl.mutate({
        cadence: `
          import TriviaAdmin from 0xTriviaAdmin

          transaction(
            text: String, 
            options: [String], 
            correctOptionIndex: UInt, 
            category: String, 
            difficulty: UInt
          ) {
            prepare(signer: auth(BorrowValue) &Account) {
              let adminRef = signer.capabilities
                .borrow<&TriviaAdmin.Admin>(/public/TriviaGameAdmin)
                ?? panic("No admin resource found")
              
              adminRef.addQuestion(
                text: text,
                options: options,
                correctOptionIndex: correctOptionIndex,
                category: category,
                difficulty: difficulty
              )
            }
          }
        `,
        args: (arg: any, t: any) => [
          arg(formData.text, t.String),
          arg(formData.options, t.Array(t.String)),
          arg(correctOptionIndex, t.UInt),
          arg(formData.category, t.String),
          arg(Number(formData.difficulty), t.UInt),
        ],
        proposer: authorizationFunction,
        payer: authorizationFunction,
        authorizations: [authorizationFunction],
        limit: 999,
      });

      const transaction = await fcl.tx(txId).onceSealed();

      // Check transaction status
      if (transaction.status === 4) {
        const errorEvent = transaction.events?.find((e: any) => 
          e.type.includes("Error") || e.type.includes("Failure")
        );
        if (errorEvent) {
          throw new Error(errorEvent.data?.message || "Transaction failed");
        }
        setSuccess("Question added successfully!");
        setFormData({
          text: "",
          options: ["", ""],
          correctOptionIndex: 0,
          category: "General",
          difficulty: 1,
        });
      } else {
        throw new Error(`Transaction failed with status ${transaction.status}`);
      }
    } catch (err) {
      console.error("Transaction error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background with overlay */}
      <div className="fixed inset-0 z-0">
        <img src={bgImage} alt="background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="max-w-2xl mx-auto p-6 relative z-10">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
          <h2 className="text-2xl font-bold mb-6 text-white">Create New Challenge</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-4 bg-green-500/30 border border-green-500/50 text-green-300 rounded-lg">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white mb-2" htmlFor="text">
                Challenge Text
              </label>
              <input
                id="text"
                name="text"
                type="text"
                value={formData.text}
                onChange={handleChange}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-white mb-2">Possible Answers</label>
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={formData.correctOptionIndex === index}
                    onChange={() => setFormData(prev => ({
                      ...prev,
                      correctOptionIndex: index
                    }))}
                    className="mr-2 accent-yellow-500"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50"
                    required
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="ml-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="mt-2 px-4 py-2 bg-yellow-500/80 hover:bg-yellow-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Add Answer Option
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white mb-2" htmlFor="category">
                  Realm
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="General">General Knowledge</option>
                  <option value="Sports">Sports & Games</option>
                  <option value="History">Ancient History</option>
                  <option value="Science">Arcane Sciences</option>
                  <option value="Entertainment">Entertainment</option>
                </select>
              </div>

              <div>
                <label className="block text-white mb-2" htmlFor="difficulty">
                  Challenge Level (1-5)
                </label>
                <input
                  id="difficulty"
                  name="difficulty"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.difficulty}
                  onChange={handleChange}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-yellow-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-all duration-300 transform hover:scale-105 ${
                isSubmitting 
                  ? 'bg-gray-500/50 cursor-not-allowed' 
                  : 'bg-yellow-500/80 hover:bg-yellow-600'
              }`}
            >
              {isSubmitting ? 'Casting Spell...' : 'Create Challenge'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}